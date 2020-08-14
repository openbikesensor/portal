var mongoose = require('mongoose');

var TrackDataSchema = new mongoose.Schema({
//Date;Time;Latitude;Longitude;Course;Speed;Right;Left;Confirmed;insidePrivacyArea
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

mongoose.model('TrackData', TrackDataSchema);
