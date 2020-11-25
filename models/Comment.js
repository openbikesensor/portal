const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    body: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    track: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
  },
  { timestamps: true },
);

class Comment extends mongoose.Model {
  toJSONFor(user) {
    return {
      id: this._id,
      body: this.body,
      createdAt: this.createdAt,
      author: this.author.toProfileJSONFor(user),
    };
  }
}

mongoose.model(Comment, schema);

module.exports = Comment;
