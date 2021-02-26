const mongoose = require('mongoose');
const _ = require('lodash');
const uniqueValidator = require('mongoose-unique-validator');
const { DateTime } = require('luxon');
const slug = require('slug');
const path = require('path');
const sanitize = require('sanitize-filename');
const fs = require('fs');

const { parseTrackPoints } = require('../logic/tracks');

const TrackData = require('./TrackData');

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data/');

const schema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: String,
    description: String,
    visible: Boolean,
    uploadedByUserAgent: String,
    body: String, // deprecated, remove after migration has read it
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    trackData: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackData' },
    publicTrackData: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackData' },
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
    originalFilePath: String,
  },
  { timestamps: true },
);

schema.plugin(uniqueValidator, { message: 'is already taken' });

schema.pre('validate', async function (next) {
  try {
    if (!this.slug) {
      this.slugify();
    }

    if (!this.originalFilePath) {
      await this.generateOriginalFilePath();
    }

    next();
  } catch (err) {
    next(err);
  }
});

// 0..4 Night, 4..10 Morning, 10..14 Noon, 14..18 Afternoon, 18..22 Evening, 22..00 Night
// Two hour intervals
const DAYTIMES = [
  'Night',
  'Night',
  'Morning',
  'Morning',
  'Morning',
  'Noon',
  'Noon',
  'Afternoon',
  'Afternoon',
  'Afternoon',
  'Evening',
  'Evening',
  'Evening',
  'Night',
];

function getDaytime(dateTime) {
  return DAYTIMES[Math.floor((dateTime.hour % 24) / 2)];
}

class Track extends mongoose.Model {
  slugify() {
    this.slug = slug(this.title || 'track') + '-' + ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
  }

  async generateOriginalFilePath() {
    await this.populate('author').execPopulate();
    this.originalFilePath = path.join('uploads', 'originals', this.author.username, this.slug, 'original.csv');
  }

  isVisibleTo(user) {
    if (this.visible) {
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
    if (!this.originalFilePath) {
      await this.generateOriginalFilePath();
    }

    const dir = path.join(DATA_DIR, path.dirname(this.originalFilePath));
    await fs.promises.mkdir(dir, { recursive: true });
  }

  get fullOriginalFilePath() {
    return path.join(DATA_DIR, this.originalFilePath);
  }

  async writeToOriginalFile(fileBody) {
    await this._ensureDirectoryExists();
    await fs.promises.writeFile(this.fullOriginalFilePath, fileBody);
  }

  /**
   * Fills the trackData and publicTrackData with references to correct
   * TrackData objects.  For now, this is either the same, or publicTrackData
   * is set to null, depending on the visibility of the track. At some point,
   * this will include the anonymisation step, and produce a distinct TrackData
   * object for the publicTrackData reference.
   *
   * Existing TrackData objects will be deleted by this function.
   */
  async rebuildTrackDataAndSave() {
    // clean up existing track data, we want to actually fully delete it
    if (this.trackData) {
      await TrackData.findByIdAndDelete(this.trackData);
    }

    if (this.publicTrackData && this.publicTrackData.equals(this.trackData)) {
      await TrackData.findByIdAndDelete(this.publicTrackData);
    }

    // Parse the points from the body.
    // TODO: Stream file contents, if possible
    const body = await fs.promises.readFile(this.fullOriginalFilePath);
    const points = Array.from(parseTrackPoints(body));

    const trackData = TrackData.createFromPoints(points);
    await trackData.save();

    this.trackData = trackData._id;

    if (this.visible) {
      // TODO: create a distinct object with filtered data
      this.publicTrackData = trackData._id;
    }

    await this.save();
  }

  async autoGenerateTitle() {
    if (this.title) {
      return;
    }

    if (this.originalFileName) {
      this.title = _.upperFirst(_.words(this.originalFileName.replace(/(\.obsdata)?\.csv$/, '')).join(' '));
    }

    for (const property of ['publicTrackData', 'trackData']) {
      if (!this.title && this[property]) {
        await this.populate(property).execPopulate();
        if (this[property].recordedAt) {
          const dateTime = DateTime.fromJSDate(this[property].recordedAt);
          const daytime = getDaytime(dateTime);
          this.title = `${daytime} ride on ${dateTime.toLocaleString(DateTime.DATE_MED)}`;
        }
      }
    }

    if (this.title) {
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
      visible: this.visible,
      author: this.author.toProfileJSONFor(user),
      ...(includePrivateFields
        ? {
            uploadedByUserAgent: this.uploadedByUserAgent,
            originalFileName: this.originalFileName,
          }
        : {}),
    };
  }
}

mongoose.model(Track, schema);

module.exports = Track;
