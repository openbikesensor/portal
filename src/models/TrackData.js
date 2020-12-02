const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const turf = require('turf');

const schema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    numEvents: { type: Number, default: 0 },
    recordedAt: { type: Date },
    recordedUntil: { type: Date },
    trackLength: { type: Number },
    points: [
      {
        date: String,
        time: String,
        latitude: Number,
        longitude: Number,
        course: Number,
        speed: Number,
        d1: Number,
        d2: Number,
        flag: Number,
        private: Number,
      },
    ],
  },
  { timestamps: true },
);

schema.plugin(uniqueValidator, { message: 'is already taken' });

schema.pre('validate', function (next) {
  if (!this.slug) {
    this.slugify();
  }
  next();
});

schema.set('toJSON', { virtuals: true });

class TrackData extends mongoose.Model {
  slugify() {
    this.slug = 'td-' + String((Math.random() * Math.pow(36, 6)) | 0).toString(36);
  }

  countEvents() {
    return this.points.filter((p) => p.flag).length;
  }

  getRecoredAt(findEnd = false) {
    const pointsWithDate = this.points.filter((p) => p.date && p.time);

    if (!pointsWithDate.length) {
      return null;
    }

    const point = pointsWithDate[findEnd ? pointsWithDate.length - 1 : 0];
    const [day, month, year] = point.date.split('.');
    const combinedString = `${year}-${month}-${day} ${point.time}.000+2000`;
    const parsedDate = new Date(combinedString);
    if (isNaN(parsedDate.getDate())) {
      return null;
    }

    return parsedDate;
  }

  static createFromPoints(points) {
    const trackData = new TrackData();
    trackData.points = points;
    trackData.numEvents = trackData.countEvents();
    trackData.recordedAt = trackData.getRecoredAt();
    trackData.recordedUntil = trackData.getRecoredAt(true);
    trackData.trackLength = trackData.measureTrackLength();
    return trackData;
  }

  measureTrackLength() {
    let totalLength = 0;
    for (const [a, b] of pairwise(map(this.points, (p) => turf.point([p.longitude, p.latitude])))) {
      const legLengthMeters = turf.distance(a, b) * 1000;
      totalLength += legLengthMeters;
    }
    return totalLength;
  }

  get duration() {
    if (this.recordedAt == null || this.recordedUntil == null) {
      return null;
    }

    return (this.recordedUntil.getTime() - this.recordedAt.getTime()) / 1000;
  }
}

function* pairwise(iter) {
  let last;
  let firstLoop = true;
  for (const it of iter) {
    if (firstLoop) {
      firstLoop = false;
    } else {
      yield [last, it];
    }
    last = it;
  }
}

function* enumerate(iter) {
  let i = 0;
  for (const it of iter) {
    yield [i, it];
    i++;
  }
}

function* map(iter, fn) {
  for (const [i, it] of enumerate(iter)) {
    yield fn(it, i);
  }
}

mongoose.model(TrackData, schema);

module.exports = TrackData;
