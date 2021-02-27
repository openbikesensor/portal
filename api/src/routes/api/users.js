const router = require('express').Router();
const wrapRoute = require('../../_helpers/wrapRoute');
const auth = require('../../passport');

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

// Remove this at some point
router.post('/users/login',
  auth.usernameAndPassword,
  wrapRoute((req, res) => {
    return res.json({ user: req.user.toAuthJSON() });
  }),
);

module.exports = router;
