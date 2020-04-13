var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var slug = require('slug');
var User = mongoose.model('User');

var TrackSchema = new mongoose.Schema({
  slug: {type: String, lowercase: true, unique: true},
  title: String,
  description: String,
  body: String,
  numEvents: {type: Number, default: 0},
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {timestamps: true});

TrackSchema.plugin(uniqueValidator, {message: 'is already taken'});

TrackSchema.pre('validate', function(next){
  if(!this.slug)  {
    this.slugify();
  }

  next();
});

TrackSchema.methods.slugify = function() {
  this.slug = slug(this.title) + '-' + (Math.random() * Math.pow(36, 6) | 0).toString(36);
};

TrackSchema.methods.toJSONFor = function(user){
  return {
    slug: this.slug,
    title: this.title,
    description: this.description,
    body: this.body,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    visibleForAll: user ? user.areTracksVisibleForAll : false,
    author: this.author.toProfileJSONFor(user)
  };
};

mongoose.model('Track', TrackSchema);
