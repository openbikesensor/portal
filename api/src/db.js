const mongoose = require('mongoose');

const config = require('./config')

mongoose.connect(config.mongodb.url);
mongoose.set('debug', config.mongodb.debug);

require('./models/User');
require('./models/Track');
require('./models/Comment');
require('./passport');

module.exports = mongoose;
