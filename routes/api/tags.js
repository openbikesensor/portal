var router = require('express').Router();
var mongoose = require('mongoose');
var Track = mongoose.model('Track');

// return a list of tags
router.get('/', function(req, res, next) {
  Track.find().distinct('tagList').then(function(tags){
    return res.json({tags: tags});
  }).catch(next);
});

module.exports = router;
