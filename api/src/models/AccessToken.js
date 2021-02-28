const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const crypto = require('crypto');

const schema = new mongoose.Schema(
  {
    token: { index: true, type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scope: { type: String, required: true, defaultValue: '*' },
  },
  { timestamps: true },
);

schema.plugin(uniqueValidator, { message: 'reused token' });

class AccessToken extends mongoose.Model {
  toJSON() {
    return {
      token: this.token,
      expires: this.expires,
    };
  }

  isValid() {
    return this.expiresAt < new Date()
  }

  toHeaderString() {
    return 'Bearer ' + this.token;
  }

  static generate(options, expiresInSeconds = 24 * 60 * 60) {
    const token = crypto.randomBytes(32).toString('hex');

    return new AccessToken({
      ...options,
      token,
      expiresAt: new Date(new Date().getTime() + 1000 * expiresInSeconds),
    });
  }
}

mongoose.model(AccessToken, schema);

module.exports = AccessToken;
