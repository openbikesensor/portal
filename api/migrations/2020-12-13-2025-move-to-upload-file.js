
const Track = require('../src/models/Track');

module.exports = {
  async up(next) {
    try {
      for await (const track of Track.find()) {
        if (!track.body) {
          continue
        }

        await track.writeToOriginalFile(track.body)
        delete track.body;
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
