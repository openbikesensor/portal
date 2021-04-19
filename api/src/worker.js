const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const queue = require('./queue');
require('./db');
const { Track } = require('./models');
const { PROCESSING_DIR, OBS_FACE_CACHE_DIR, PROCESSING_OUTPUT_DIR } = require('./paths');

queue.process('processTrack', async (job) => {
  const track = await Track.findById(job.data.trackId);
  if (!track) {
    throw new Error('Cannot find track to process');
  }

  if (track.processingJobId !== job.id) {
    throw new Error('Track is processed by another job');
  }

  if (track.processingJobId !== job.id) {
    throw new Error('Track is processed by another job');
  }

  if (track.processingStatus !== 'pending') {
    throw new Error('Track is not pending processing');
  }

  try {
    const { filePath } = track;
    console.log('Will process track', filePath);

    track.processingStatus = 'processing';
    track.processingLog = '';
    await track.save();

    // Create input directory
    const inputDirectory = path.join(PROCESSING_DIR, filePath);
    await fs.promises.mkdir(inputDirectory, { recursive: true });

    // copy original file to processing dir
    const inputFilePath = path.join(inputDirectory, 'track.csv');
    const originalFilePath = track.getOriginalFilePath()
    console.log(`[${track.slug}] Copy ${originalFilePath} to ${inputFilePath}`);
    await fs.promises.copyFile(originalFilePath, inputFilePath);

    // Create output directory
    const outputDirectory = path.join(PROCESSING_OUTPUT_DIR, filePath);
    await fs.promises.mkdir(outputDirectory, { recursive: true });

    const stdoutFile = path.join(outputDirectory, 'stdout.log');
    const stderrFile = path.join(outputDirectory, 'stderr.log');
    const stdout = fs.createWriteStream(stdoutFile);
    const stderr = fs.createWriteStream(stderrFile);

    // TODO: Generate track transformation settings (privacy zones etc)
    // const settingsFilePath = path.join(inputDirectory, 'track-settings.json');
    const child = spawn(
      'obs-process-track',
      [
        '--input',
        inputFilePath,
        '--output',
        outputDirectory,
        '--path-cache',
        OBS_FACE_CACHE_DIR,
        '--district',
        'Freiburg im Breisgau',
        // '--anonymize-user-id', 'remove',
        // '--anonymize-measurement-id', 'remove',
      ],
      {
        cwd: PROCESSING_DIR,
      },
    );

    child.stdout.pipe(process.stdout);
    child.stdout.pipe(stdout);
    child.stderr.pipe(process.stderr);
    child.stderr.pipe(stderr);

    const code = await new Promise((resolve) => child.on('close', resolve));

    track.processingLog += (
      await Promise.all([
        fs.promises.readFile(stdoutFile),
        fs.promises.readFile(stderrFile),
        // split lines
      ])
    )
      .join('\n')
      .trim();

    if (code !== 0) {
      throw new Error(`Track processing failed with status ${code}`);
    }

    // Read some results back into the database for quick access and
    // accumulation
    const statisticsContent = await fs.promises.readFile(path.join(outputDirectory, 'statistics.json'));
    track.statistics = JSON.parse(statisticsContent);

    track.processingStatus = 'complete';
    await track.save();
  } catch (err) {
    console.error('Processing failed:', err);
    track.processingLog += String(err) + '\n' + err.stack + '\n';
    track.processingStatus = 'error';
    await track.save();
  }
});

console.log('Worker started.');
