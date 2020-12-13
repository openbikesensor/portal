const Track = require('../src/models/Track');

module.exports = {
  async up(next) {
    try {
      for await (const track of Track.find()) {
        track.originalFileName = track.slug + '.csv'
        await track.generateOriginalFilePath();
        await track.save()
      }
      next();
    } catch(err) {
      next(err)
    }
  },

  async down(next) {
    next();
  },
};

