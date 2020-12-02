const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const turf = require('turf');

const { flow, filter, map, pairwise, reduce } = require('../_helpers/generators');

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
    return flow(
      filter((p) => p.latitude != null && p.longitude != null),
      map((p) => turf.point([p.longitude, p.latitude])),
      pairwise,
      map(([a, b]) => turf.distance(a, b) * 1000),

      // Ignore distances between two points that are bigger than 100m, this
      // must be a gap in the data or a mistake.
      filter((d) => d <= 100),
      reduce((c, d) => c + d, 0),
    )(this.points);
  }

  get duration() {
    if (this.recordedAt == null || this.recordedUntil == null) {
      return null;
    }

    return (this.recordedUntil.getTime() - this.recordedAt.getTime()) / 1000;
  }
}

mongoose.model(TrackData, schema);

module.exports = TrackData;
