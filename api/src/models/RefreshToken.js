const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const crypto = require('crypto');

const AccessToken = require('./AccessToken')

const schema = new mongoose.Schema(
  {
    token: { index: true, type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    expiresAt: { type: Date, required: false },
    scope: { type: String, required: true, defaultValue: '*' },
  },
  { timestamps: true },
);

schema.plugin(uniqueValidator, { message: 'reused token' });

class RefreshToken extends mongoose.Model {
  toJSON() {
    return {
      token: this.token,
      expires: this.expires,
    };
  }

  isValid() {
    return this.expiresAt == null || this.expiresAt < new Date()
  }

  static generate(client, user, scope = '*', expiresInSeconds = 24 * 60 * 60) {
    const token = crypto.randomBytes(32).toString('hex');

    return new RefreshToken({
      token,
      client,
      user,
      expiresAt: new Date(new Date().getTime() + 1000 * expiresInSeconds),
      scope,
    });
  }

  genererateAccessToken(expiresInSeconds = undefined) {
    return AccessToken.generate(this.user, this.scope, expiresInSeconds)
  }
}

mongoose.model(RefreshToken, schema);

module.exports = RefreshToken;
