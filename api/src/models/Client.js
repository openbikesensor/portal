const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    clientId: { type: String, required: true }, // this is external, so we do not use the ObjectID
    validRedirectUris: [{ type: String }],

    // this implementation deals with public clients only, so the following fields are not required:
    // scope: {type: String, required: true, default: '*'}, // max possible scope
    // confidential: {type: Boolean}, // whether this is a non-public, aka confidential client
    // clientSecret: { type: String },
  },
  { timestamps: true },
);

class Client extends mongoose.Model {}

mongoose.model(Client, schema);

module.exports = Client;
