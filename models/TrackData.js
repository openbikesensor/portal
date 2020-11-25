const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const slug = require('slug');

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
}

mongoose.model(TrackData, schema);

module.exports = TrackData;
