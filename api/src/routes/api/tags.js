const router = require('express').Router();
const mongoose = require('mongoose');
const Track = mongoose.model('Track');
const wrapRoute = require('../../_helpers/wrapRoute');

// return a list of tags
router.get(
  '/',
  wrapRoute(async (req, res) => {
    const tags = await Track.find().distinct('tagList');
    return res.json({ tags: tags });
  }),
);

module.exports = router;
