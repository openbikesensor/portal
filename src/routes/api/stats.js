const router = require('express').Router();
const mongoose = require('mongoose');
const Track = mongoose.model('Track');
const wrapRoute = require('../../_helpers/wrapRoute');

// round to this number of meters for privacy reasons
const TRACK_LENGTH_ROUNDING = 1000

router.get(
  '/',
  wrapRoute(async (req, res) => {
    const [{totalTrackLength, totalPublicTrackLength}] = await Track.aggregate([
      {$lookup: { from: 'trackdatas', localField: 'publicTrackData', foreignField: '_id', as: 'publicTrackDatas' }},
      {$lookup: { from: 'trackdatas', localField: 'trackData', foreignField: '_id', as: 'trackDatas' }},
      {$addFields: {publicTrackLength: {$first: '$publicTrackDatas.trackLength'}, trackLength: {$first: '$trackDatas.trackLength'}}},
      {$project: {publicTrackLength: true, trackLength: true}},
      {$group: {_id: "sum", totalTrackLength: {$sum: '$trackLength'}, totalPublicTrackLength: {$sum: '$publicTrackLength'}}},
    ])

    const totalTrackLengthPrivatized = Math.floor(totalTrackLength / TRACK_LENGTH_ROUNDING) * TRACK_LENGTH_ROUNDING;

    return res.json({
      totalTrackLength: totalTrackLengthPrivatized ,
      totalPublicTrackLength,
    });
  })
);

module.exports = router;
