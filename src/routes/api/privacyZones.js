const router = require('express').Router();
const mongoose = require('mongoose');
const PrivacyZone = mongoose.model('PrivacyZone');
const busboy = require('connect-busboy');
const auth = require('../auth');
const wrapRoute = require('../../_helpers/wrapRoute');

function preloadByParam(target, getValueFromParam) {
  return async (req, res, next, paramValue) => {
    try {
      const value = await getValueFromParam(paramValue);

      if (!value) {
        return res.sendStatus(404);
      }

      req[target] = value;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

router.param(
  'privacyZone',
  preloadByParam('privacyZone', (id) => PrivacyZone.findOne({ _id: id }).populate('user')),
);

router.get(
  '/',
  auth.required,
  wrapRoute(async (req, res) => {
    const privacyZones = await PrivacyZone.find({ user: req.user._id });

    return res.json({
      privacyZones,
    });
  }),
);

router.post(
  '/',
  auth.required,
  wrapRoute(async (req, res) => {
    const privacyZone = new PrivacyZone(req.body);
    privacyZone.user = req.user._id;
    await privacyZone.save();
    return res.json({ privacyZone });
  }),
);

router.get(
  '/:privacyZone',
  auth.required,
  wrapRoute(async (req, res) => {
    if (!req.privacyZone.user._id.equals(req.user._id)) {
      return res.sendStatus(403);
    }

    return res.json({ privacyZone: req.privacyZone });
  }),
);

router.put(
  '/:privacyZone',
  busboy(),
  auth.required,
  wrapRoute(async (req, res) => {
    if (!req.privacyZone.user._id.equals(req.user.id)) {
      return res.sendStatus(403);
    }

    for (const key of ['center', 'radius', 'title']) {
      if (key in req.body) {
        req.privacyZone[key] = req.body[key]
      }
    }

    return res.json({ privacyZone: req.privacyZone})
  }),
);

router.delete(
  '/:privacyZone',
  auth.required,
  wrapRoute(async (req, res) => {
    if (!req.privacyZone.user._id.equals(req.user.id)) {
      return res.sendStatus(403);
    }

    await req.privacyZone.remove();
    return res.sendStatus(204);
  }),
);

module.exports = router;
