const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const slug = require('slug');

const TrackSchema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: String,
    description: String,
    body: String,
    visible: Boolean,
    numEvents: { type: Number, default: 0 },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    trackData: { type: mongoose.Schema.Types.ObjectId, ref: 'TrackData' },
  },
  { timestamps: true },
);

TrackSchema.plugin(uniqueValidator, { message: 'is already taken' });

TrackSchema.pre('validate', function (next) {
  if (!this.slug) {
    this.slugify();
  }

  next();
});

TrackSchema.methods.slugify = function () {
  this.slug = slug(this.title) + '-' + ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
};

TrackSchema.methods.toJSONFor = function (user, include) {
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
};

mongoose.model('Track', TrackSchema);
