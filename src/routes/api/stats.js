const router = require('express').Router();
const mongoose = require('mongoose');
const Track = mongoose.model('Track');
const User = mongoose.model('User');
const wrapRoute = require('../../_helpers/wrapRoute');

// round to this number of meters for privacy reasons
const TRACK_LENGTH_ROUNDING = 1000

router.get(
  '/',
  wrapRoute(async (req, res) => {
    const trackCount = await Track.find().count()
    const publicTrackCount =  await Track.find({visible: true}).count()
    const userCount =  await User.find().count()

    const [{trackLength, publicTrackLength, numEvents}] = await Track.aggregate([
      {$lookup: { from: 'trackdatas', localField: 'publicTrackData', foreignField: '_id', as: 'publicTrackDatas' }},
      {$lookup: { from: 'trackdatas', localField: 'trackData', foreignField: '_id', as: 'trackDatas' }},
      {$addFields: {
        publicTrackLength: {$first: '$publicTrackDatas.trackLength'},
        trackLength: {$first: '$trackDatas.trackLength'},
        numEvents: {$first: '$publicTrackDatas.numEvents'},
      }},
      {$project: {publicTrackLength: true, trackLength: true, numEvents: true}},
      {$group: {_id: "sum",
        trackLength: {$sum: '$trackLength'},
        publicTrackLength: {$sum: '$publicTrackLength'},
        numEvents: {$sum: '$numEvents'},
      }},
    ])

    const trackLengthPrivatized = Math.floor(trackLength / TRACK_LENGTH_ROUNDING) * TRACK_LENGTH_ROUNDING;

    return res.json({
      publicTrackCount,
      publicTrackLength,
      trackLength: trackLengthPrivatized ,
      numEvents,
      trackCount,
      userCount,
    });
  })
);

module.exports = router;
