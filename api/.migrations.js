const isProduction = process.env.NODE_ENV === 'production';
const mongodbUrl =
  process.env.MONGODB_URL || (isProduction ? 'mongodb://localhost/obs' : 'mongodb://localhost/obsTest');

module.exports = {
    mongoose: 'src/db',
    db: mongodbUrl,
}
