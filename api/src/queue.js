const Bull = require('bull');

const config = require('./config');

module.exports = new Bull('processQueue', config.redisUrl, {
  settings: {
    // if the worker process is killed and restarted, e.g. due to reboot or
    // upgrade, it is okay to wait for a timeout on the job and restart it
    maxStalledCount: 3,
    lockDuration: 120 * 1000,
  },
});
