const mongoose = require('mongoose');
const Track = require('../src/models/Track');

const { replaceDollarNewlinesHack, detectFormat, buildObsver1 } = require('../src/logic/tracks');

// connect to database
require('../src/db');

function shouldRebuildBody(track) {
  if (!track.trackData || !track.trackData.points.length) {
    return false;
  }

  if (!track.body) {
    return true;
  }
  const body = track.body.trim();
  if (!body) {
    return true;
  }

  const actualBody = replaceDollarNewlinesHack(body).trim();
  if (body !== actualBody) {
    return true;
  }

  const lineCount = (actualBody.match(/\n/g) || []).length + 1;

  const format = detectFormat(body);
  if (format === 'invalid') {
    return true;
  }

  // never reconstruct body of version 2
  if (format > 1) {
    return false;
  }

  // not enough data in the file
  if (lineCount < track.trackData.points.length + 1) {
    return true;
  }

  return false;
}

async function main() {
  const query = Track.find().populate('trackData');
  for await (const track of query) {
    const rebuild = shouldRebuildBody(track);
    if (rebuild) {
      console.log('Rebuilding', track.title, 'with', track.trackData.points.length, 'data points.');

      track.body = buildObsver1(track.trackData.points);
    }

    if (!track.recordedAt) {
      const firstPointWithDate = track.trackData.points.find((p) => p.date && p.time);
      if (firstPointWithDate) {
        const [day, month, year] = firstPointWithDate.date.split('.');
        const combinedString = `${year}-${month}-${day} ${firstPointWithDate.time}.000+2000`;
        const parsedDate = new Date(combinedString);
        if (!isNaN(parsedDate.getDate())) {
          track.recordedAt = parsedDate;
        }
      }
    }

    if (!track.numEvents) {
      track.numEvents = track.trackData.points.filter((p) => p.flag).length;
    }

    await track.save();
  }
}

main()
  .catch((err) => console.error(err))
  .finally(() => mongoose.connection.close());
