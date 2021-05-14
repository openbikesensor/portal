const router = require('express').Router();
const mongoose = require('mongoose');
const Track = mongoose.model('Track');
const User = mongoose.model('User');
const wrapRoute = require('../../_helpers/wrapRoute');

// round to this number of meters for privacy reasons
const TRACK_LENGTH_ROUNDING = 1000;

// round to this number of seconds for privacy reasons
const TRACK_DURATION_ROUNDING = 120;

router.get(
  '/',
  wrapRoute(async (req, res) => {
    const trackCount = await Track.find().count();
    const publicTrackCount = await Track.find({ public: true }).count();
    const userCount = await User.find().count();

    const trackStats = await Track.aggregate([
      {
        $addFields: {
          trackLength: {
            $cond: [
              {$lt: ['$statistics.length', 500000]},
              '$statistics.length',
              0,
            ],
          },
          numEvents: '$statistics.numEvents',
          trackDuration: {
            $cond: [
              { $and: ['$statistics.recordedUntil', '$statistics.recordedAt', {$gt: ['$statistics.recordedAt', new Date('2010-01-01')]}] },
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

    const [trackLength, numEvents, trackDuration] = trackStats.length > 0
      ? [trackStats[0].trackLength, trackStats[0].numEvents, trackStats[0].trackDuration]
      : [0,0,0];

    const trackLengthPrivatized = Math.floor(trackLength / TRACK_LENGTH_ROUNDING) * TRACK_LENGTH_ROUNDING;
    const trackDurationPrivatized = Math.round(trackDuration / 1000 / TRACK_DURATION_ROUNDING) * TRACK_DURATION_ROUNDING;

    return res.json({
      publicTrackCount,
      trackLength: trackLengthPrivatized,
      trackDuration: trackDurationPrivatized,
      numEvents,
      trackCount,
      userCount,
    });
  }),
);

module.exports = router;
