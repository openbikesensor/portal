const router = require('express').Router();
const mongoose = require('mongoose');
const User = mongoose.model('User');
const wrapRoute = require('../../_helpers/wrapRoute');
const auth = require('../auth');

// Preload user profile on routes with ':username'
router.param('username', async function (req, res, next, username) {
  try {
    const user = await User.findOne({ username: username });
    if (!user) {
      return res.sendStatus(404);
    }

    req.profile = user;

    return next();
  } catch (err) {
    next(err);
  }
});

router.get(
  '/:username',
  auth.optional,
  wrapRoute(async (req, res) => {
    if (!req.payload) {
      return res.json({ profile: req.profile.toProfileJSONFor(false) });
    }

    const user = await User.findById(req.payload.id);
    if (!user) {
      return res.json({ profile: req.profile.toProfileJSONFor(false) });
    }

    return res.json({ profile: req.profile.toProfileJSONFor(user) });
  }),
);

router.post(
  '/:username/follow',
  auth.required,
  wrapRoute(async (req, res) => {
    const profileId = req.profile._id;

    const user = await User.findById(req.payload.id);
    if (!user) {
      return res.sendStatus(401);
    }

    await user.follow(profileId);
    return res.json({ profile: req.profile.toProfileJSONFor(user) });
  }),
);

router.delete(
  '/:username/follow',
  auth.required,
  wrapRoute(async (req, res) => {
    const profileId = req.profile._id;

    const user = User.findById(req.payload.id);
    if (!user) {
      return res.sendStatus(401);
    }

    await user.unfollow(profileId);
    return res.json({ profile: req.profile.toProfileJSONFor(user) });
  }),
);

module.exports = router;
