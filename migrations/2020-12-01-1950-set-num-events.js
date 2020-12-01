const Track = require('../src/models/Track');

module.exports = {
  async up(next) {
    const query = Track.find().populate('trackData');
    for await (const track of query) {
      if (!track.numEvents) {
        track.numEvents = track.trackData.countEvents();
      }

      await track.save();
    }

    next();
  },

  async down(next) {
    const query = Track.find();
    for await (const track of query) {
      track.numEvents = null;
      await track.save();
    }

    next();
  },
};
