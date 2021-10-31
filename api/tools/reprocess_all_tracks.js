require('../src/db');

const { Track } = require('../src/models');

async function main() {
  for (const track of await Track.find()) {
    console.log('queuing', track.slug);
    await track.queueProcessing();
  }
}

main()
  .then(() => {
    process.exit(1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
