const mongoose = require('mongoose');

const isProduction = process.env.NODE_ENV === 'production';
const mongodbUrl =
  process.env.MONGODB_URL || (isProduction ? 'mongodb://localhost/obs' : 'mongodb://localhost/obsTest');
mongoose.connect(mongodbUrl);
mongoose.set('debug', !isProduction);

require('./models/TrackData');
require('./models/User');
require('./models/Track');
require('./models/Comment');
require('./config/passport');

module.exports = mongoose;
