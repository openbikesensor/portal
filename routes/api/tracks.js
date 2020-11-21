const router = require('express').Router();
const mongoose = require('mongoose');
const TrackData = mongoose.model('TrackData');
const Track = mongoose.model('Track');
const Comment = mongoose.model('Comment');
const User = mongoose.model('User');
const busboy = require('connect-busboy');
const auth = require('../auth');
const currentTracks = new Map();
const { parseTrackPoints } = require('../../logic/tracks');
const wrapRoute = require('../../_helpers/wrapRoute');

// Preload track objects on routes with ':track'
router.param('track', async (req, res, next, slug) => {
  try {
    const track = await Track.findOne({ slug }).populate('author');

    if (!track) {
      return res.sendStatus(404);
    }

    req.track = track;

    return next();
  } catch (err) {
    return next(err);
  }
});

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
    const query = {};
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

    const [author, favoriter] = await Promise.all([
      req.query.author ? User.findOne({ username: req.query.author }) : null,
      req.query.favorited ? User.findOne({ username: req.query.favorited }) : null,
    ]);

    if (author) {
      query.author = author._id;
    }

    if (favoriter) {
      query._id = { $in: favoriter.favorites };
    } else if (req.query.favorited) {
      query._id = { $in: [] };
    }

    const results = await Promise.all([
      Track.find(query)
        .limit(Number(limit))
        .skip(Number(offset))
        .sort({ createdAt: 'desc' })
        .populate('author')
        .where('visible')
        .equals(true)
        .exec(),
      Track.countDocuments(query).exec(),
      req.payload ? User.findById(req.payload.id) : null,
    ]);

    const [tracks, tracksCount, user] = results;

    return res.json({
      tracks: tracks.map((track) => track.toJSONFor(user)),
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

    const user = await User.findById(req.payload.id);

    if (!user) {
      return res.sendStatus(401);
    }

    const showByUserIds = [req.payload.id, ...(user.following || [])];

    const [tracks, tracksCount] = await Promise.all([
      Track.find({ author: { $in: showByUserIds } })
        .limit(Number(limit))
        .skip(Number(offset))
        .populate('author')
        .exec(),
      Track.countDocuments({ author: { $in: showByUserIds } }),
    ]);

    return res.json({
      tracks: tracks.map(function (track) {
        return track.toJSONFor(user);
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
    const user = await User.findById(req.payload.id);

    if (!user) {
      return res.sendStatus(401);
    }

    const { body } = await getMultipartOrJsonBody(req, (body) => body.track);

    const track = new Track(body);
    const trackData = new TrackData();
    track.trackData = trackData._id;
    track.author = user;

    if (track.body) {
      track.body = track.body.trim();
    }

    if (track.body) {
      trackData.points = Array.from(parseTrackPoints(track.body));
    }

    track.visible = track.author.areTracksVisibleForAll;

    await trackData.save();
    await track.save();

    // console.log(track.author);
    return res.json({ track: track.toJSONFor(user) });
  }),
);

router.post(
  '/begin',
  auth.optional,
  wrapRoute(async (req, res) => {
    const user = await User.findById(req.body.id);

    if (!user) {
      return res.sendStatus(401);
    }

    const track = new Track(req.body.track);
    const trackData = new TrackData();
    track.trackData = trackData._id;
    track.author = user;

    await track.save();
    await trackData.save();

    // remember which is the actively building track for this user
    currentTracks.set(user.id, track._id);

    return res.sendStatus(200);
  }),
);

router.post(
  '/add',
  auth.optional,
  wrapRoute(async (req, res) => {
    const user = await User.findById(req.body.id);

    if (!user) {
      return res.sendStatus(401);
    }

    if (!currentTracks.has(user.id)) {
      throw new Error('current user has no active track, start one with POST to /tracks/begin');
    }

    const trackId = currentTracks.get(user.id);

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
  auth.optional,
  wrapRoute(async (req, res) => {
    const user = await User.findById(req.body.id);

    if (!user) {
      return res.sendStatus(401);
    }

    let track;
    let trackData;

    if (currentTracks.has(user.id)) {
      // the file is less than 100 lines
      const trackId = currentTracks.get(user.id);
      track = await Track.findById(trackId);
      if (!track) {
        throw new Error('current user active track is gone, retry upload');
      }

      track.body += req.body.track.body;
      trackData = await TrackData.findById(track.trackData);
    } else {
      track = new Track(req.body.track);
      trackData = new TrackData();
      track.trackData = trackData._id;
      track.author = user;
    }

    trackData.points = Array.from(parseTrackPoints(track.body));

    await track.save();
    await trackData.save();

    // We are done with this track, it is complete.
    currentTracks.delete(user.id);

    return res.sendStatus(200);
  }),
);

// return a track
router.get(
  '/:track',
  auth.optional,
  wrapRoute(async (req, res) => {
    const [user] = await Promise.all([
      req.payload ? User.findById(req.payload.id) : null,
      req.track.populate('author').execPopulate(),
    ]);

    if (!req.track.visible && req.track.author._id.toString() !== req.payload?.id?.toString()) {
      return res.sendStatus(403);
    }

    return res.json({ track: req.track.toJSONFor(user, { body: true }) });
  }),
);

// update track
router.put(
  '/:track',
  busboy(),
  auth.required,
  wrapRoute(async (req, res) => {
    const user = await User.findById(req.payload.id);

    if (req.track.author._id.toString() !== req.payload.id.toString()) {
      return res.sendStatus(403);
    }

    const { body } = await getMultipartOrJsonBody(req, (body) => body.track);

    if (typeof body.title !== 'undefined') {
      req.track.title = body.title;
    }

    if (typeof body.description !== 'undefined') {
      req.track.description = body.description;
    }

    if (body && body.trim()) {
      req.track.body = body.body.trim();

      let trackData = await TrackData.findById(req.track.trackData);
      if (!trackData) {
        trackData = new TrackData();
        req.track.trackData = trackData._id;
      }
      trackData.points = Array.from(parseTrackPoints(req.track.body));
      await trackData.save();
    }

    if (typeof body.tagList !== 'undefined') {
      req.track.tagList = body.tagList;
    }
    req.track.visible = body.visible;

    const track = await req.track.save();
    return res.json({ track: track.toJSONFor(user) });
  }),
);

// delete track
router.delete(
  '/:track',
  auth.required,
  wrapRoute(async (req, res) => {
    const user = await User.findById(req.payload.id);
    if (!user) {
      return res.sendStatus(401);
    }
    if (req.track.author._id.toString() === req.payload.id.toString()) {
      await TrackData.findByIdAndDelete(req.track.trackData);
      await req.track.remove();
      return res.sendStatus(204);
    } else {
      return res.sendStatus(403);
    }
  }),
);

// Favorite an track
router.post(
  '/:track/favorite',
  auth.required,
  wrapRoute(async (req, res) => {
    const trackId = req.track._id;

    const user = await User.findById(req.payload.id);
    if (!user) {
      return res.sendStatus(401);
    }

    await user.favorite(trackId);
    const track = await req.track.updateFavoriteCount();
    return res.json({ track: track.toJSONFor(user) });
  }),
);

// Unfavorite an track
router.delete(
  '/:track/favorite',
  auth.required,
  wrapRoute(async (req, res) => {
    const trackId = req.track._id;

    const user = await User.findById(req.payload.id);
    if (!user) {
      return res.sendStatus(401);
    }

    await user.unfavorite(trackId);
    const track = await req.track.updateFavoriteCount();
    return res.json({ track: track.toJSONFor(user) });
  }),
);

// return an track's comments
router.get(
  '/:track/comments',
  auth.optional,
  wrapRoute(async (req, res) => {
    const user = await Promise.resolve(req.payload ? User.findById(req.payload.id) : null);

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
        return comment.toJSONFor(user);
      }),
    });
  }),
);

// create a new comment
router.post(
  '/:track/comments',
  auth.required,
  wrapRoute(async (req, res) => {
    const user = await User.findById(req.payload.id);
    if (!user) {
      return res.sendStatus(401);
    }

    const comment = new Comment(req.body.comment);
    comment.track = req.track;
    comment.author = user;

    await comment.save();

    req.track.comments.push(comment);

    await req.track.save();
    return res.json({ comment: comment.toJSONFor(user) });
  }),
);

router.delete(
  '/:track/comments/:comment',
  auth.required,
  wrapRoute(async (req, res) => {
    if (req.comment.author.toString() === req.payload.id.toString()) {
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
    // console.log("requestTrackData"+req.track);
    const trackData = await TrackData.findById(req.track.trackData);
    // console.log({trackData: trackData});
    return res.json({ trackData: trackData });
  }),
);

module.exports = router;
