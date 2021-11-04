const crypto = require('crypto');
const mongoose = require('mongoose');
const _ = require('lodash');
const uniqueValidator = require('mongoose-unique-validator');
const { DateTime } = require('luxon');
const slug = require('slug');
const path = require('path');
const sanitize = require('sanitize-filename');
const fs = require('fs');
const uuid = require('uuid/v4');

const { TRACKS_DIR } = require('../paths');
const queue = require('../queue');

const statisticsSchema = new mongoose.Schema(
  {
    recordedAt: Date,
    recordedUntil: Date,
    duration: Number,
    length: Number,
    segments: Number,
    numEvents: Number,
    numMeasurements: Number,
    numValid: Number,
  },
  { timestamps: false },
);

const schema = new mongoose.Schema(
  {
    // A (partially or entirely random generated) string that can be used as a
    // public identifier
    slug: { type: String, lowercase: true, unique: true },

    // The title for this track.
    title: String,

    // The status of this track, whether it is to be processed, is currently
    // being processed, or has completed or errored.
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'complete', 'error'],
      default: 'pending',
    },
    processingJobId: String,

    // Output from the proccessing routines regarding this track. Might be
    // displayed to the owner or administrators to help in debugging. Should be
    // set to `null` if no processing has not been finished.
    processingLog: String,

    // Set to true if the user customized the title. Disables auto-generating
    // an updated title when the track is (re-)processed.
    customizedTitle: { type: Boolean, default: false },

    // A user-provided description of the track. May contain markdown.
    description: String,

    // Whether this track is visible (anonymized) in the public track list or not.
    public: { type: Boolean, default: false },

    // Whether this track should be exported to the public track database
    // (after anonymization).
    includeInPublicDatabase: { type: Boolean, default: false },

    // The user agent string, or a part thereof, that was used to upload this
    // track. Usually contains only the OBS version, other user agents are
    // discarded due to being irrelevant.
    uploadedByUserAgent: String,

    // The name of the original file, as provided during upload. Used for
    // providing a download with the same name, and for display in the
    // frontend.
    originalFileName: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          // Must be a sane filename, i.e. not change when being sanitized
          return sanitize(v) === v && v.length > 0 && /.+\.csv$/i.test(v);
        },
        message: (props) => `${props.value} is not a valid filename`,
      },
    },

    // A hash of the original file's contents. Nobody can upload the same track twice.
    originalFileHash: {
      type: String,
      required: true,
    },

    // Where the files are stored, relative to a group directory like
    // TRACKS_DIR or PROCESSING_DIR.
    filePath: String,

    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    statistics: statisticsSchema,
  },
  { timestamps: true },
);

schema.index({ author: 1, originalFileHash: 1 }, { unique: true });

schema.plugin(uniqueValidator, { message: 'is already taken' });

schema.pre('validate', async function (next) {
  try {
    if (!this.slug) {
      this.slugify();
    }

    if (!this.filePath) {
      await this.generateFilePath();
    }

    next();
  } catch (err) {
    next(err);
  }
});

// 0..4 Night, 4..10 Morning, 10..14 Noon, 14..18 Afternoon, 18..22 Evening, 22..00 Night
// Two hour intervals
const DAYTIMES = [
  'Night', // 0h - 2h
  'Night', // 2h - 4h
  'Morning', // 4h - 6h
  'Morning', // 6h - 8h
  'Morning', // 8h - 10h
  'Noon', // 10h - 12h
  'Noon', // 12h - 14h
  'Afternoon', // 14h - 16h
  'Afternoon', // 16h - 18h
  'Evening', // 18h - 20h
  'Evening', // 20h - 22h
  'Night', // 22h - 24h
];

function getDaytime(dateTime) {
  return DAYTIMES[Math.floor((dateTime.hour % 24) / 2)];
}

class TrackClass extends mongoose.Model {
  slugify() {
    this.slug = slug(this.title || 'track') + '-' + ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
  }

  async generateFilePath() {
    await this.populate('author');
    this.filePath = path.join(this.author.username, this.slug);
  }

  isVisibleTo(user) {
    if (this.public) {
      return true;
    }

    if (!user) {
      return false;
    }

    if (user._id.equals(this.author._id)) {
      return true;
    }

    return false;
  }

  isVisibleToPrivate(user) {
    return user && user._id.equals(this.author._id);
  }

  async _ensureDirectoryExists() {
    if (!this.filePath) {
      await this.generateFilePath();
    }

    const dir = path.dirname(this.getOriginalFilePath());
    await fs.promises.mkdir(dir, { recursive: true });
  }

  getOriginalFilePath() {
    if (!this.filePath) {
      throw new Error('Cannot get original file path, `filePath` is not yet set. Call `generateFilePath()` first.');
    }
    return path.join(TRACKS_DIR, this.filePath, 'original.csv');
  }

  async writeToOriginalFile(fileBody) {
    await this._ensureDirectoryExists();
    await fs.promises.writeFile(this.getOriginalFilePath(), fileBody);
  }

  async validateFileBodyUniqueness(fileBody) {
    // Generate hash
    const hash = crypto.createHash('sha512').update(fileBody).digest('hex');

    const existingTracks = await Track.find({ originalFileHash: hash, author: this.author });
    if (existingTracks.length === 0 || (existingTracks.length === 1 && existingTracks[0]._id.equals(this._id))) {
      this.originalFileHash = hash;
      return;
    }

    throw new Error('Track file already uploaded.');
  }

  /**
   * Marks this track as needing processing.
   *
   * Also deletes all stored information that is derived during processing from
   * the database, such that it may be filled again with correct information
   * during the processing operation.
   *
   * Saves the track as well, so it is up to date when the worker receives it.
   */
  async queueProcessing() {
    this.processingStatus = 'pending';
    this.processingLog = null;
    this.processingJobId = uuid();
    this.statistics = null;

    await this.save();

    await queue.add(
      'processTrack',
      {
        trackId: this._id.toString(),
      },
      {
        jobId: this.processingJobId,
      },
    );
  }

  async readProcessingResults(success = true) {
    // Copies some information into this object from the outputs of the
    // processing step. This allows general statistics to be formed, and other
    // information to be displayed, without having to read individual files
    // from disk. Each field set here should be unsed in `queueProcessing`.
    // This routine also moves the `processingStatus` along.
  }

  async autoGenerateTitle() {
    if (this.customizedTitle) {
      return;
    }

    // Try to figure out when this file was recorded. Either we have it in then
    // statistics, e.g. after parsing and processing the track, or we can maybe
    // derive it from the filename.
    let recordedAt = null;

    if (this.statistics && this.statistics.recordedAt != null) {
      recordedAt = DateTime.fromJSDate(this.statistics.recordedAt);
    } else if (this.originalFileName) {
      const match = this.originalFileName.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}\.[0-9]{2}\.[0-9]{2}/);
      if (match) {
        recordedAt = DateTime.fromFormat(match[0], "yyyy-MM-dd'T'HH.mm.ss");
        if (!recordedAt.isValid) {
          recordedAt = null;
        }
      }
    }

    if (recordedAt) {
      const daytime = getDaytime(recordedAt);
      this.title = `${daytime} ride on ${recordedAt.toLocaleString(recordedAt.DATE_MED)}`;
      await this.save();
      return;
    }

    // Detecting recording date failed, use filename
    if (this.originalFileName) {
      this.title = _.upperFirst(_.words(this.originalFileName.replace(/(\.obsdata)?\.csv$/, '')).join(' '));
      await this.save();
    }
  }

  toJSONFor(user) {
    const includePrivateFields = user && user._id.equals(this.author._id);

    return {
      slug: this.slug,
      title: this.title,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      public: this.public,
      author: this.author.toProfileJSONFor(user),
      statistics: this.statistics,
      processingStatus: this.processingStatus,
      ...(includePrivateFields
        ? {
            uploadedByUserAgent: this.uploadedByUserAgent,
            originalFileName: this.originalFileName,
          }
        : {}),
    };
  }
}

schema.loadClass(TrackClass);
const Track = mongoose.model('Track', schema);
module.exports = Track;
