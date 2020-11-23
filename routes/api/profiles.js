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
    return res.json({ profile: req.profile.toProfileJSONFor(req.user) });
  }),
);

router.post(
  '/:username/follow',
  auth.required,
  wrapRoute(async (req, res) => {
    await req.user.follow(req.profile._id);
    return res.json({ profile: req.profile.toProfileJSONFor(user) });
  }),
);

router.delete(
  '/:username/follow',
  auth.required,
  wrapRoute(async (req, res) => {
    await req.user.unfollow(req.profile._id);
    return res.json({ profile: req.profile.toProfileJSONFor(user) });
  }),
);

module.exports = router;
