const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    clientId: { type: String, required: true }, // this is external, so we do not use the ObjectID
    validRedirectUris: [{ type: String }],

    // this implementation deals with public clients only, so the following fields are not required:
    // confidential: {type: Boolean}, // whether this is a non-public, aka confidential client
    // clientSecret: { type: String },

    // Set `refreshTokenExpirySeconds` to null to issue no refresh tokens.  Set
    // to a number of seconds to issue refresh tokens with that duration. No
    // infinite tokens are ever issued, set to big number to simulate that.
    refreshTokenExpirySeconds: {
      type: Number,
      required: false,
      defaultValue: null,
      min: 1, // 0 would make no sense, use `null` to issue no token
      max: 1000 * 24 * 60 * 60, // 1000 days, nearly 3 years
    },

    // Set to a scope which cannot be exceeded when requesting client tokens.
    // Clients must manually request a scope that is smaller or equal to this
    // scope to get a valid response. Scopes are not automatically truncated.
    // Leave empty or set to `"*"` for unlimited scopes in this client.
    maxScope: { type: String, required: false },
  },
  { timestamps: true },
);

class Client extends mongoose.Model {}

mongoose.model(Client, schema);

module.exports = Client;
