var router = require('express').Router();
var mongoose = require('mongoose');
var Track = mongoose.model('Track');
var Comment = mongoose.model('Comment');
var User = mongoose.model('User');
var auth = require('../auth');

// Preload track objects on routes with ':track'
router.param('track', function(req, res, next, slug) {
  Track.findOne({ slug: slug})
    .populate('author')
    .then(function (track) {
      if (!track) { return res.sendStatus(404); }

      req.track = track;

      return next();
    }).catch(next);
});

router.param('comment', function(req, res, next, id) {
  Comment.findById(id).then(function(comment){
    if(!comment) { return res.sendStatus(404); }

    req.comment = comment;

    return next();
  }).catch(next);
});

router.get('/', auth.optional, function(req, res, next) {
  var query = {};
  var limit = 20;
  var offset = 0;

  if(typeof req.query.limit !== 'undefined'){
    limit = req.query.limit;
  }

  if(typeof req.query.offset !== 'undefined'){
    offset = req.query.offset;
  }

  if( typeof req.query.tag !== 'undefined' ){
    query.tagList = {"$in" : [req.query.tag]};
  }

  Promise.all([
    req.query.author ? User.findOne({username: req.query.author}) : null,
    req.query.favorited ? User.findOne({username: req.query.favorited}) : null
  ]).then(function(results){
    var author = results[0];
    var favoriter = results[1];

    if(author){
      query.author = author._id;
    }

    if(favoriter){
      query._id = {$in: favoriter.favorites};
    } else if(req.query.favorited){
      query._id = {$in: []};
    }

    return Promise.all([
      Track.find(query)
        .limit(Number(limit))
        .skip(Number(offset))
        .sort({createdAt: 'desc'})
        .populate('author')
        .exec(),
      Track.count(query).exec(),
      req.payload ? User.findById(req.payload.id) : null,
    ]).then(function(results){
      var tracks = results[0];
      var tracksCount = results[1];
      var user = results[2];

      return res.json({
        tracks: tracks.map(function(track){
          return track.toJSONFor(user);
        }),
        tracksCount: tracksCount
      });
    });
  }).catch(next);
});

router.get('/feed', auth.required, function(req, res, next) {
  var limit = 20;
  var offset = 0;

  if(typeof req.query.limit !== 'undefined'){
    limit = req.query.limit;
  }

  if(typeof req.query.offset !== 'undefined'){
    offset = req.query.offset;
  }

  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }
    if(user.following != '')
    {
    Promise.all([
      Track.find({ author: {$in: user.following}})
        .limit(Number(limit))
        .skip(Number(offset))
        .populate('author')
        .exec(),
      Track.count({ author: {$in: user.following}})
    ]).then(function(results){
      var tracks = results[0];
      var tracksCount = results[1];

      return res.json({
        tracks: tracks.map(function(track){
          return track.toJSONFor(user);
        }),
        tracksCount: tracksCount
      });
    }).catch(next);
    }
    else
    {
    Promise.all([
      Track.find({ author: {$in: req.payload.id}})
        .limit(Number(limit))
        .skip(Number(offset))
        .populate('author')
        .exec(),
      Track.count({ author: {$in: req.payload.id}})
    ]).then(function(results){
      var tracks = results[0];
      var tracksCount = results[1];

      return res.json({
        tracks: tracks.map(function(track){
          return track.toJSONFor(user);
        }),
        tracksCount: tracksCount
      });
    }).catch(next);
    }



  });
});

router.post('/', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    var track = new Track(req.body.track);

    track.author = user;

    return track.save().then(function(){
      console.log(track.author);
      return res.json({track: track.toJSONFor(user)});
    });
  }).catch(next);
});

router.post('/add', auth.optional, function(req, res, next) {
      console.log("Add");
if(true)
{
      console.log(req.body);
      console.log(req.payload);
  User.findById(req.body.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    var track = new Track(req.body.track);

    track.author = user;

    return track.save().then(function(){
      console.log(track.author);
      return res.json({track: track.toJSONFor(user)});
    });
  }).catch(next);
}
});

// return a track
router.get('/:track', auth.optional, function(req, res, next) {
  Promise.all([
    req.payload ? User.findById(req.payload.id) : null,
    req.track.populate('author').execPopulate()
  ]).then(function(results){
    var user = results[0];

    return res.json({track: req.track.toJSONFor(user)});
  }).catch(next);
});

// update track
router.put('/:track', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if(req.track.author._id.toString() === req.payload.id.toString()){
      if(typeof req.body.track.title !== 'undefined'){
        req.track.title = req.body.track.title;
      }

      if(typeof req.body.track.description !== 'undefined'){
        req.track.description = req.body.track.description;
      }

      if(typeof req.body.track.body !== 'undefined'){
        req.track.body = req.body.track.body;
      }

      if(typeof req.body.track.tagList !== 'undefined'){
        req.track.tagList = req.body.track.tagList
      }

      req.track.save().then(function(track){
        return res.json({track: track.toJSONFor(user)});
      }).catch(next);
    } else {
      return res.sendStatus(403);
    }
  });
});

// delete track
router.delete('/:track', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    if(req.track.author._id.toString() === req.payload.id.toString()){
      return req.track.remove().then(function(){
        return res.sendStatus(204);
      });
    } else {
      return res.sendStatus(403);
    }
  }).catch(next);
});

// Favorite an track
router.post('/:track/favorite', auth.required, function(req, res, next) {
  var trackId = req.track._id;

  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    return user.favorite(trackId).then(function(){
      return req.track.updateFavoriteCount().then(function(track){
        return res.json({track: track.toJSONFor(user)});
      });
    });
  }).catch(next);
});

// Unfavorite an track
router.delete('/:track/favorite', auth.required, function(req, res, next) {
  var trackId = req.track._id;

  User.findById(req.payload.id).then(function (user){
    if (!user) { return res.sendStatus(401); }

    return user.unfavorite(trackId).then(function(){
      return req.track.updateFavoriteCount().then(function(track){
        return res.json({track: track.toJSONFor(user)});
      });
    });
  }).catch(next);
});

// return an track's comments
router.get('/:track/comments', auth.optional, function(req, res, next){
  Promise.resolve(req.payload ? User.findById(req.payload.id) : null).then(function(user){
    return req.track.populate({
      path: 'comments',
      populate: {
        path: 'author'
      },
      options: {
        sort: {
          createdAt: 'desc'
        }
      }
    }).execPopulate().then(function(track) {
      return res.json({comments: req.track.comments.map(function(comment){
        return comment.toJSONFor(user);
      })});
    });
  }).catch(next);
});

// create a new comment
router.post('/:track/comments', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if(!user){ return res.sendStatus(401); }

    var comment = new Comment(req.body.comment);
    comment.track = req.track;
    comment.author = user;

    return comment.save().then(function(){
      req.track.comments.push(comment);

      return req.track.save().then(function(track) {
        res.json({comment: comment.toJSONFor(user)});
      });
    });
  }).catch(next);
});

router.delete('/:track/comments/:comment', auth.required, function(req, res, next) {
  if(req.comment.author.toString() === req.payload.id.toString()){
    req.track.comments.remove(req.comment._id);
    req.track.save()
      .then(Comment.find({_id: req.comment._id}).remove().exec())
      .then(function(){
        res.sendStatus(204);
      });
  } else {
    res.sendStatus(403);
  }
});

module.exports = router;
