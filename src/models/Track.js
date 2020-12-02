const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const slug = require('slug');

const { parseTrackPoints } = require('../logic/tracks');

const TrackData = require('./TrackData');

const schema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: String,
    description: String,
    body: String,
    visible: Boolean,
    uploadedByUserAgent: String,
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    trackData: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackData' },
    publicTrackData: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackData' },
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

class Track extends mongoose.Model {
  slugify() {
    this.slug = slug(this.title) + '-' + ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
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
    return user._id.equals(this.author._id);
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

    // parse the points from the body
    const points = Array.from(parseTrackPoints(this.body));
    const trackData = TrackData.createFromPoints(points);
    await trackData.save();

    this.trackData = trackData._id;

    if (this.visible) {
      // TODO: create a distinct object with filtered data
      this.publicTrackData = trackData._id;
    }

    await this.save();
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
      ...(includePrivateFields ? { uploadedByUserAgent: this.uploadedByUserAgent } : {}),
    };
  }
}

mongoose.model(Track, schema);

module.exports = Track;
