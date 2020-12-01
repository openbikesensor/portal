const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const schema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
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

class TrackData extends mongoose.Model {
  slugify() {
    this.slug = 'td-' + String((Math.random() * Math.pow(36, 6)) | 0).toString(36);
  }

  countEvents() {
    return this.points.filter((p) => p.flag).length;
  }

  getRecoredAt() {
    const firstPointWithDate = this.points.find((p) => p.date && p.time);
    if (!firstPointWithDate) {
      return null;
    }

    const [day, month, year] = firstPointWithDate.date.split('.');
    const combinedString = `${year}-${month}-${day} ${firstPointWithDate.time}.000+2000`;
    const parsedDate = new Date(combinedString);
    if (isNaN(parsedDate.getDate())) {
      return null;
    }

    return parsedDate;
  }
}

mongoose.model(TrackData, schema);

module.exports = TrackData;
