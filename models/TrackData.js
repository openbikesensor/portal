var mongoose = require('mongoose');
var uniqueValidator = require('mongoose-unique-validator');
var slug = require('slug');

var TrackDataSchema = new mongoose.Schema({
  slug: {type: String, lowercase: true, unique: true},
  points: [ { 
     date: String,
     time : String,
     latitude: Number,
     longitude: Number,
     course: Number,
     speed: Number,
     d1: Number,
     d2: Number,
     flag: Number,
     private: Number
     }]
}, {timestamps: true});

TrackDataSchema.plugin(uniqueValidator, {message: 'is already taken'});

TrackDataSchema.pre('validate', function(next){
  if(!this.slug)  {
    this.slugify();
  }
  next();
});

TrackDataSchema.methods.slugify = function() {
  this.slug = slug("td") + '-' + (Math.random() * Math.pow(36, 6) | 0).toString(36);
};

mongoose.model('TrackData', TrackDataSchema);
