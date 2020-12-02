const router = require('express').Router();
const mongoose = require('mongoose');
const TrackData = mongoose.model('TrackData');
const Track = mongoose.model('Track');
const Comment = mongoose.model('Comment');
const User = mongoose.model('User');
const busboy = require('connect-busboy');
const auth = require('../auth');
const currentTracks = new Map();
const { normalizeUserAgent } = require('../../logic/tracks');
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
  'track',
  preloadByParam('track', (slug) => Track.findOne({ slug }).populate('author')),
);
router.param(
  'comment',
  preloadByParam('comment', (id) => Comment.findById(id)),
);

router.param('comment', async (req, res, next, id) => {
  try {
    const comment = await Comment.findById(id);

    if (!comment) {
      return res.sendStatus(404);
    }

    req.comment = comment;

    return next();
  } catch (err) {
    return next(err);
  }
});

router.get(
  '/',
  auth.optional,
  wrapRoute(async (req, res) => {
    const query = { visible: true };
    let limit = 20;
    let offset = 0;

    if (typeof req.query.limit !== 'undefined') {
      limit = req.query.limit;
    }

    if (typeof req.query.offset !== 'undefined') {
      offset = req.query.offset;
    }

    if (typeof req.query.tag !== 'undefined') {
      query.tagList = { $in: [req.query.tag] };
    }

    const author = req.query.author ? await User.findOne({ username: req.query.author }) : null;

    if (author) {
      query.author = author._id;
    }

    const [tracks, tracksCount] = await Promise.all([
      Track.find(query).limit(Number(limit)).skip(Number(offset)).sort({ createdAt: 'desc' }).populate('author').exec(),
      Track.countDocuments(query).exec(),
    ]);

    return res.json({
      tracks: tracks.map((track) => track.toJSONFor(req.user)),
      tracksCount,
    });
  }),
);

router.get(
  '/feed',
  auth.required,
  wrapRoute(async (req, res) => {
    let limit = 20;
    let offset = 0;

    if (typeof req.query.limit !== 'undefined') {
      limit = req.query.limit;
    }

    if (typeof req.query.offset !== 'undefined') {
      offset = req.query.offset;
    }

    const query = { author: req.user.id };
    const [tracks, tracksCount] = await Promise.all([
      Track.find(query).limit(Number(limit)).skip(Number(offset)).populate('author').exec(),
      Track.countDocuments(query),
    ]);

    return res.json({
      tracks: tracks.map(function (track) {
        return track.toJSONFor(req.user);
      }),
      tracksCount: tracksCount,
    });
  }),
);

async function readFile(file) {
  let fileContent = '';

  file.on('data', function (data) {
    fileContent += data;
  });

  await new Promise((resolve, reject) => {
    file.on('end', resolve);
    file.on('error', reject);
  });

  return fileContent;
}

async function getMultipartOrJsonBody(req, mapJsonBody = (x) => x) {
  const fileInfo = {};
  let body;

  if (req.busboy) {
    body = {};

    req.busboy.on('file', async function (fieldname, file, filename, encoding, mimetype) {
      body[fieldname] = await readFile(file);
      fileInfo[fieldname] = { filename, encoding, mimetype };
    });

    req.busboy.on('field', (key, value) => {
      body[key] = value;
    });

    req.pipe(req.busboy);

    await new Promise((resolve, reject) => {
      req.busboy.on('finish', resolve);
      req.busboy.on('error', reject);
    });
  } else if (req.headers['content-type'] === 'application/json') {
    body = mapJsonBody(req.body);
  } else {
    body = { body: await readFile(req), ...req.query };
    fileInfo.body = {
      mimetype: req.headers['content-type'],
      filename: req.headers['content-disposition'],
      encoding: req.headers['content-encoding'],
    };
  }

  return { body, fileInfo };
}

router.post(
  '/',
  auth.required,
  busboy(), // parse multipart body
  wrapRoute(async (req, res) => {
    const { body } = await getMultipartOrJsonBody(req, (body) => body.track);

    const track = new Track(body);
    track.author = req.user;

    if (track.body) {
      track.body = track.body.trim();
    }

    if (track.body) {
      // delete existing
      if (track.trackData) {
        await TrackData.findByIdAndDelete(track.trackData);
      }
    }

    if (body.visible != null) {
      track.visible = Boolean(body.visible);
    } else {
      track.visible = track.author.areTracksVisibleForAll;
    }

    await track.save();

    // console.log(track.author);
    return res.json({ track: track.toJSONFor(req.user) });
  }),
);

router.post(
  '/begin',
  auth.required,
  wrapRoute(async (req, res) => {
    const track = new Track(req.body.track);
    track.author = req.user;
    track.uploadedByUserAgent = normalizeUserAgent(req.headers['user-agent']);

    await track.save();

    // remember which is the actively building track for this user
    currentTracks.set(req.user.id, track._id);

    return res.sendStatus(200);
  }),
);

router.post(
  '/add',
  auth.required,
  wrapRoute(async (req, res) => {
    if (!currentTracks.has(req.user.id)) {
      throw new Error('current user has no active track, start one with POST to /tracks/begin');
    }

    const trackId = currentTracks.get(req.user.id);

    const track = await Track.findById(trackId);
    if (!track) {
      throw new Error('current user active track is gone, retry upload');
    }

    track.body += req.body.track.body;
    await track.save();

    return res.sendStatus(200);
  }),
);

router.post(
  '/end',
  auth.required,
  wrapRoute(async (req, res) => {
    let track;

    if (currentTracks.has(req.user.id)) {
      // the file is less than 100 lines
      const trackId = currentTracks.get(req.user.id);
      track = await Track.findById(trackId);
      if (!track) {
        throw new Error('current user active track is gone, retry upload');
      }

      track.body += req.body.track.body;
    } else {
      track = new Track(req.body.track);
    }

    await track.rebuildTrackDataAndSave();

    // We are done with this track, it is complete.
    currentTracks.delete(req.user.id);

    return res.sendStatus(200);
  }),
);

// return a track
router.get(
  '/:track',
  auth.optional,
  wrapRoute(async (req, res) => {
    if (!req.track.isVisibleTo(req.user)) {
      return res.sendStatus(403);
    }

    return res.json({ track: req.track.toJSONFor(req.user) });
  }),
);

// update track
router.put(
  '/:track',
  busboy(),
  auth.required,
  wrapRoute(async (req, res) => {
    const track = req.track;

    if (!track.author._id.equals(req.user.id)) {
      return res.sendStatus(403);
    }

    const { body } = await getMultipartOrJsonBody(req, (body) => body.track);

    if (typeof body.title !== 'undefined') {
      track.title = (body.title || '').trim() || null;
    }

    if (typeof body.description !== 'undefined') {
      track.description = (body.description || '').trim() || null;
    }

    if (body.visible != null) {
      track.visible = Boolean(body.visible);
    }

    let bodyChanged = false;

    if (body.body && body.body.trim()) {
      track.body = body.body.trim();
      track.uploadedByUserAgent = normalizeUserAgent(req.headers['user-agent']);
      bodyChanged = true;
    }

    if (typeof body.tagList !== 'undefined') {
      track.tagList = body.tagList;
    }

    if (bodyChanged) {
      await track.rebuildTrackDataAndSave();
    } else {
      await track.save();
    }

    return res.json({ track: track.toJSONFor(req.user) });
  }),
);

// delete track
router.delete(
  '/:track',
  auth.required,
  wrapRoute(async (req, res) => {
    if (req.track.author._id.equals(req.user.id)) {
      await TrackData.findByIdAndDelete(req.track.trackData);
      await req.track.remove();
      return res.sendStatus(204);
    } else {
      return res.sendStatus(403);
    }
  }),
);

// return an track's comments
router.get(
  '/:track/comments',
  auth.optional,
  wrapRoute(async (req, res) => {
    if (!req.track.isVisibleTo(req.user)) {
      return res.sendStatus(403);
    }

    await req.track
      .populate({
        path: 'comments',
        populate: {
          path: 'author',
        },
        options: {
          sort: {
            createdAt: 'desc',
          },
        },
      })
      .execPopulate();

    return res.json({
      comments: req.track.comments.map(function (comment) {
        return comment.toJSONFor(req.user);
      }),
    });
  }),
);

// create a new comment
router.post(
  '/:track/comments',
  auth.required,
  wrapRoute(async (req, res) => {
    const comment = new Comment(req.body.comment);
    comment.track = req.track;
    comment.author = req.user;

    await comment.save();

    req.track.comments.push(comment);

    await req.track.save();
    return res.json({ comment: comment.toJSONFor(req.user) });
  }),
);

router.delete(
  '/:track/comments/:comment',
  auth.required,
  wrapRoute(async (req, res) => {
    if (req.comment.author.equals(req.user.id)) {
      req.track.comments.remove(req.comment._id);
      await req.track.save();
      await Comment.find({ _id: req.comment._id }).remove();
      res.sendStatus(204);
    } else {
      res.sendStatus(403);
    }
  }),
);

// return an track's trackData
router.get(
  '/:track/TrackData',
  auth.optional,
  wrapRoute(async (req, res) => {
    if (!req.track.isVisibleTo(req.user)) {
      return res.sendStatus(403);
    }

    const trackData = await TrackData.findById(req.track.trackData);

    return res.json({ trackData });
  }),
);

module.exports = router;
