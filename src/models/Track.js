const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const slug = require('slug');

const schema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: String,
    description: String,
    body: String,
    visible: Boolean,
    uploadedByUserAgent: String,
    numEvents: { type: Number, default: 0 },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    trackData: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackData' },
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

  toJSONFor(user, include) {
    return {
      slug: this.slug,
      title: this.title,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      visibleForAll: this.author ? this.author.areTracksVisibleForAll : false,
      visible: this.visible,
      author: this.author.toProfileJSONFor(user),
      ...(include && include.body ? { body: this.body } : {}),
    };
  }
}

mongoose.model(Track, schema);

module.exports = Track;
