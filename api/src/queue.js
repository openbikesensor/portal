const Bull = require('bull')

const config = require('./config')

module.exports = new Bull('processQueue', config.redisUrl)
