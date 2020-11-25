const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema(
  {
    body: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    track: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
  },
  { timestamps: true },
);

// Requires population of author
CommentSchema.methods.toJSONFor = function (user) {
  return {
    id: this._id,
    body: this.body,
    createdAt: this.createdAt,
    author: this.author.toProfileJSONFor(user),
  };
};

mongoose.model('Comment', CommentSchema);
