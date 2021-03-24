const router = require('express').Router();
const mongoose = require('mongoose');
const Track = mongoose.model('Track');
const User = mongoose.model('User');
const wrapRoute = require('../../_helpers/wrapRoute');

// round to this number of meters for privacy reasons
const TRACK_LENGTH_ROUNDING = 1000;

router.get(
  '/',
  wrapRoute(async (req, res) => {
    const trackCount = await Track.find().count();
    const publicTrackCount = await Track.find({ visible: true }).count();
    const userCount = await User.find().count();
    let trackLength = 0;
    let publicTrackLength = 0;
    let numEvents = 0;
    let trackDuration = 0;

    if (trackCount) {
      [{ trackLength, publicTrackLength, numEvents, trackDuration }] = await Track.aggregate([
        { $lookup: { from: 'trackdatas', localField: 'publicTrackData', foreignField: '_id', as: 'publicTrackDatas' } },
        { $lookup: { from: 'trackdatas', localField: 'trackData', foreignField: '_id', as: 'trackDatas' } },
        {
          $addFields: {
            publicTrackData: { $arrayElemAt: ['$publicTrackDatas', 0] },
            trackData: { $arrayElemAt: ['$trackDatas', 0] },
          },
        },
        {
          $addFields: {
            publicTrackLength: '$publicTrackData.trackLength',
            trackLength: '$trackData.trackLength',
            numEvents: '$publicTrackData.numEvents',
            trackDuration: {
              $cond: [
                { $and: ['$publicTrackData.recordedUntil', '$publicTrackData.recordedAt'] },
                { $subtract: ['$publicTrackData.recordedUntil', '$publicTrackData.recordedAt'] },
                0,
              ],
            },
          },
        },
        { $project: { publicTrackLength: true, trackLength: true, numEvents: true, trackDuration: true } },
        {
          $group: {
            _id: 'sum',
            trackLength: { $sum: '$trackLength' },
            publicTrackLength: { $sum: '$publicTrackLength' },
            numEvents: { $sum: '$numEvents' },
            trackDuration: { $sum: '$trackDuration' },
          },
        },
      ]);
    }

    const trackLengthPrivatized = Math.floor(trackLength / TRACK_LENGTH_ROUNDING) * TRACK_LENGTH_ROUNDING;

    return res.json({
      publicTrackCount,
      publicTrackLength,
      trackLength: trackLengthPrivatized,
      numEvents,
      trackCount,
      trackDuration: Math.round(trackDuration / 1000),
      userCount,
    });
  }),
);

module.exports = router;
