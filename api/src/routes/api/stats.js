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

    const [{ trackLength, numEvents, trackDuration }] = await Track.aggregate([
      {
        $addFields: {
          trackLength: '$statistics.length',
          numEvents: '$statistics.numEvents',
          trackDuration: {
            $cond: [
              { $and: ['$statistics.recordedUntil', '$statistics.recordedAt'] },
              { $subtract: ['$statistics.recordedUntil', '$statistics.recordedAt'] },
              0,
            ],
          },
        },
      },
      { $project: {trackLength: true, numEvents: true, trackDuration: true } },
      {
        $group: {
          _id: 'sum',
          trackLength: { $sum: '$trackLength' },
          numEvents: { $sum: '$numEvents' },
          trackDuration: { $sum: '$trackDuration' },
        },
      },
    ]);

    const trackLengthPrivatized = Math.floor(trackLength / TRACK_LENGTH_ROUNDING) * TRACK_LENGTH_ROUNDING;

    return res.json({
      publicTrackCount,
      publicTrackLength: trackLengthPrivatized,
      trackLength: trackLengthPrivatized,
      numEvents,
      trackCount,
      trackDuration: Math.round(trackDuration / 1000),
      userCount,
    });
  }),
);

module.exports = router;
