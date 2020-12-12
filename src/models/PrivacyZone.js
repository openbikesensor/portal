const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    required: true,
  },
  coordinates: {
    type: [Number],
    required: true,
  },
});

const schema = new mongoose.Schema(
  {
    center: {
      type: pointSchema,
      required: true,
    },
    radius: {
      type: Number,
      required: true,
    },
    name: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

class PrivacyZone extends mongoose.Model {}

mongoose.model(PrivacyZone, schema);

module.exports = PrivacyZone;
