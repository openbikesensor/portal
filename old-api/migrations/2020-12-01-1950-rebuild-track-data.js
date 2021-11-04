const Track = require('../src/models/Track');

module.exports = {
  async up(next) {
    for await (const track of Track.find()) {
      await track.rebuildTrackDataAndSave();
    }

    next();
  },

  async down(next) {
    next();
  },
};
