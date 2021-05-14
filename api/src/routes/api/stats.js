const router = require('express').Router();
const mongoose = require('mongoose');
const { DateTime } = require('luxon');

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
    const start = DateTime.fromISO(req.query.start);
    const end = DateTime.fromISO(req.query.end);

    const dateFilter = {
      $ne: null,
      ...(start.isValid ? { $gte: start.toJSDate() } : {}),
      ...(end.isValid ? { $lt: end.toJSDate() } : {}),
    };

    const trackCount = await Track.find({
      'statistics.recordedAt': dateFilter,
    }).count();

    const publicTrackCount = await Track.find({
      'statistics.recordedAt': dateFilter,
      public: true,
    }).count();

    const userCount = await User.find({
      createdAt: dateFilter,
    }).count();

    const trackStats = await Track.aggregate([
      {
        $match: {
          'statistics.recordedAt': dateFilter,
        },
      },
      {
        $addFields: {
          trackLength: {
            $cond: [{ $lt: ['$statistics.length', 500000] }, '$statistics.length', 0],
          },
          numEvents: '$statistics.numEvents',
          trackDuration: {
            $cond: [
              { $and: ['$statistics.recordedUntil', { $gt: ['$statistics.recordedAt', new Date('2010-01-01')] }] },
              { $subtract: ['$statistics.recordedUntil', '$statistics.recordedAt'] },
              0,
            ],
          },
        },
      },
      { $project: { trackLength: true, numEvents: true, trackDuration: true } },
      {
        $group: {
          _id: 'sum',
          trackLength: { $sum: '$trackLength' },
          numEvents: { $sum: '$numEvents' },
          trackDuration: { $sum: '$trackDuration' },
        },
      },
    ]);

    const [trackLength, numEvents, trackDuration] =
      trackStats.length > 0
        ? [trackStats[0].trackLength, trackStats[0].numEvents, trackStats[0].trackDuration]
        : [0, 0, 0];

    const trackLengthPrivatized = Math.floor(trackLength / TRACK_LENGTH_ROUNDING) * TRACK_LENGTH_ROUNDING;
    const trackDurationPrivatized =
      Math.round(trackDuration / 1000 / TRACK_DURATION_ROUNDING) * TRACK_DURATION_ROUNDING;

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
