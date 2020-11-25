const router = require('express').Router();
const passport = require('passport');
const wrapRoute = require('../../_helpers/wrapRoute');
const auth = require('../auth');

router.get(
  '/user',
  auth.required,
  wrapRoute(async (req, res) => {
    return res.json({ user: req.user.toAuthJSON() });
  }),
);

router.put(
  '/user',
  auth.required,
  wrapRoute(async (req, res) => {
    const user = req.user;

    // only update fields that were actually passed...
    if (typeof req.body.user.username !== 'undefined') {
      user.username = req.body.user.username;
    }
    if (typeof req.body.user.email !== 'undefined') {
      user.email = req.body.user.email;
    }
    if (typeof req.body.user.bio !== 'undefined') {
      user.bio = req.body.user.bio;
    }
    if (typeof req.body.user.image !== 'undefined') {
      user.image = req.body.user.image;
    }
    if (typeof req.body.user.areTracksVisibleForAll !== 'undefined') {
      user.areTracksVisibleForAll = req.body.user.areTracksVisibleForAll;
    }
    if (typeof req.body.user.password === 'string' && req.body.user.password !== '') {
      user.setPassword(req.body.user.password);
    }

    await user.save();
    return res.json({ user: user.toAuthJSON() });
  }),
);

router.post('/users/login', function (req, res, next) {
  if (!req.body.user.email) {
    return res.status(422).json({ errors: { email: "can't be blank" } });
  }

  if (!req.body.user.password) {
    return res.status(422).json({ errors: { password: "can't be blank" } });
  }

  passport.authenticate('local', { session: false }, function (err, user, info) {
    if (err) {
      return next(err);
    }

    if (user) {
      user.token = user.generateJWT();
      return res.json({ user: user.toAuthJSON() });
    } else {
      return res.status(422).json(info);
    }
  })(req, res, next);
});

module.exports = router;
