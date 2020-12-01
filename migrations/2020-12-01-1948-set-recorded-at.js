const Track = require('../src/models/Track');

module.exports = {
  async up(next) {
    const query = Track.find().populate('trackData');
    for await (const track of query) {
      if (!track.recordedAt) {
        track.recordedAt = track.trackData.getRecoredAt();
      }

      await track.save();
    }

    next();
  },

  async down(next) {
    const query = Track.find();
    for await (const track of query) {
      track.recordedAt = null;
      await track.save();
    }

    next();
  },
};
