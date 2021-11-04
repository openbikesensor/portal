const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    body: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    track: { type: mongoose.Schema.Types.ObjectId, ref: 'Track' },
  },
  { timestamps: true },
);

class CommentClass extends mongoose.Model {
  toJSONFor(user) {
    return {
      id: this._id,
      body: this.body,
      createdAt: this.createdAt,
      author: this.author.toProfileJSONFor(user),
    };
  }
}

schema.loadClass(CommentClass)
module.exports = mongoose.model('Comment', schema);
