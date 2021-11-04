const router = require('express').Router();
const wrapRoute = require('../../_helpers/wrapRoute');
const { Track } = require('../../models');

// return a list of tags
router.get(
  '/',
  wrapRoute(async (req, res) => {
    const tags = await Track.find().distinct('tagList');
    return res.json({ tags: tags });
  }),
);

module.exports = router;
