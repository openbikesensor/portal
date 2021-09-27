const mongoose = require('mongoose');
const crypto = require('crypto');

const schema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: String, required: true },
    scope: { type: String, required: true, defaultValue: '*' },
    redirectUri: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    codeChallenge: { type: String, required: true }, // no need to store the method, it is always "S256"
  },
  { timestamps: true },
);

class AuthorizationCodeClass extends mongoose.Model {
  static generate(options, expiresInSeconds = 60) {
    const code = crypto.randomBytes(8).toString('hex');

    return new AuthorizationCode({
      ...options,
      code,
      expiresAt: new Date(new Date().getTime() + 1000 * expiresInSeconds),
    });
  }
}

schema.loadClass(AuthorizationCodeClass)

const AuthorizationCode = mongoose.model('AuthorizationCode', schema);
module.exports = AuthorizationCode
