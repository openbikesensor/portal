const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const mongoose = require('mongoose');
const Track = mongoose.model('Track');
const Comment = mongoose.model('Comment');
const User = mongoose.model('User');
const busboy = require('connect-busboy');
const auth = require('../../passport');
const { normalizeUserAgent, buildObsver1 } = require('../../logic/tracks');
const wrapRoute = require('../../_helpers/wrapRoute');
const {PROCESSING_OUTPUT_DIR} = require('../../paths')

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
    const query = { public: true };
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
      Track.find(query).sort('-createdAt').limit(Number(limit)).skip(Number(offset)).sort({ createdAt: 'desc' }).populate('author').exec(),
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
      Track.find(query).sort('-createdAt').limit(Number(limit)).skip(Number(offset)).populate('author').exec(),
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
  auth.requiredWithUserId,
  busboy(), // parse multipart body
  wrapRoute(async (req, res) => {
    // Read the whole file into memory. This is not optimal, instead, we should
    // write the file data directly to the target file. However, we first have
    // to parse the rest of the track data to know where to place the file.
    // TODO: Stream into temporary file, then move it later.
    const { body, fileInfo } = await getMultipartOrJsonBody(req, (body) => body.track);

    const { body: fileBody, public, ...trackBody } = body

    const track = new Track({
      ...trackBody,
      author: req.user,
      public: public == null ? req.user.areTracksVisibleForAll : Boolean(trackBody.public)
    })
    track.customizedTitle = track.title != null
    track.slugify();

    if (fileBody) {
      track.uploadedByUserAgent = normalizeUserAgent(req.headers['user-agent']);
      track.originalFileName = fileInfo.body ? fileInfo.body.filename : track.slug + '.csv';
      await track.writeToOriginalFile(fileBody)
    }

    await track.save()
    await track.autoGenerateTitle()

    if (fileBody) {
      await track.queueProcessing();
    }

    // console.log(track.author);
    return res.json({ track: track.toJSONFor(req.user) });
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

    const { body: {body: fileBody, ...trackBody}, fileInfo } = await getMultipartOrJsonBody(req, (body) => body.track);

    if (typeof trackBody.title !== 'undefined') {
      track.title = (trackBody.title || '').trim() || null;
      track.customizedTitle = track.title != null
    }

    if (typeof trackBody.description !== 'undefined') {
      track.description = (trackBody.description || '').trim() || null;
    }

    let process = false

    if (trackBody.public != null) {
      const public = Boolean(trackBody.public);
      process |= public !== track.public
      track.public = public
    }

    if (fileBody) {
      track.originalFileName = fileInfo.body ? fileInfo.body.filename : track.slug + '.csv';
      track.uploadedByUserAgent = normalizeUserAgent(req.headers['user-agent']);
      await track.writeToOriginalFile(fileBody)
      process = true
    }

    await track.save();
    await track.autoGenerateTitle()

    if (process) {
      await track.queueProcessing()
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
            createdAt: 'asc',
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

// return an track's generated data
router.get(
  '/:track/data/:filename',
  auth.optional,
  wrapRoute(async (req, res) => {
    const {filename} = req.params

    if (!['statistics', 'all_measurements'].includes(filename)) {
      return res.sendStatus(404);
    }

    console.log(req.track.author, req.user)
    if (!req.track.isVisibleTo(req.user)) {
      return res.sendStatus(403);
    }

    const filePath = path.join(PROCESSING_OUTPUT_DIR, req.track.filePath, filename + '.json')

    let stats

    try {
      stats = await fs.promises.stat(filePath)
    } catch(err) {
      return res.sendStatus(404);
    }

    if (!stats.isFile()) {
      // file does not exist (yet)
      return res.sendStatus(404);
    }

    const content = await fs.promises.readFile(filePath)
    return res.json(JSON.parse(content));
  }),
);

// download the original file
router.get(
  '/:track/download/original.csv',
  auth.optional,
  wrapRoute(async (req, res) => {
    if (!req.track.isVisibleToPrivate(req.user)) {
      return res.sendStatus(403);
    }

    return res.download(req.track.getOriginalFilePath(), req.track.originalFileName)
  })
)

module.exports = router;
