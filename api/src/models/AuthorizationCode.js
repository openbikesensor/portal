const mongoose = require('mongoose');
const crypto = require('crypto');

const schema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    scope: { type: String, required: true, defaultValue: '*' },
    redirectUri: {type: String, required: true},
    expiresAt: {type: Date, required: true},
  },
  { timestamps: true },
);

class AuthorizationCode extends mongoose.Model {
  static generate(client, user, redirectUri, scope = '*', expiresInSeconds = 60) {
    const code = crypto.randomBytes(8).toString('hex');

    return new AuthorizationCode({
      code,
      user,
      client,
      redirectUri,
      expiresAt: new Date(new Date().getTime() + 1000 * expiresInSeconds),
      scope,
    });
  }
}

mongoose.model(AuthorizationCode, schema);

module.exports = AuthorizationCode;
