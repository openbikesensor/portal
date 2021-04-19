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

    // Whether this track is visible in the public track list or not.
    visible: Boolean,

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

    // Where the files are stored, relative to a group directory like
    // TRACKS_DIR or PROCESSING_DIR.
    filePath: String,

    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    statistics: statisticsSchema,
  },
  { timestamps: true },
);

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

  async generateFilePath() {
    await this.populate('author').execPopulate();
    this.filePath = path.join(this.author.username, this.slug);
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

    await this.save();

    return await queue.add(
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

    // for (const property of ['publicTrackData', 'trackData']) {
    //   if (this[property]) {
    //     await this.populate(property).execPopulate();
    //     if (this[property].recordedAt) {
    //       const dateTime = DateTime.fromJSDate(this[property].recordedAt);
    //       const daytime = getDaytime(dateTime);
    //       this.title = `${daytime} ride on ${dateTime.toLocaleString(DateTime.DATE_MED)}`;
    //       await this.save();
    //       return
    //     }
    //   }
    // }

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
      visible: this.visible,
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

mongoose.model(Track, schema);

module.exports = Track;
