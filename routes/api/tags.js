const router = require('express').Router();
const mongoose = require('mongoose');
const Track = mongoose.model('Track');

// return a list of tags
router.get('/', function (req, res, next) {
  Track.find()
    .distinct('tagList')
    .then(function (tags) {
      return res.json({ tags: tags });
    })
    .catch(next);
});

module.exports = router;
