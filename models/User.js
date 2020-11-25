const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const secret = require('../config').secret;

const schema = new mongoose.Schema(
  {
    username: {
      type: String,
      lowercase: true,
      unique: true,
      required: [true, "can't be blank"],
      match: [/^[a-zA-Z0-9]+$/, 'is invalid'],
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      unique: true,
      required: [true, "can't be blank"],
      match: [/\S+@\S+\.\S+/, 'is invalid'],
      index: true,
    },
    bio: String,
    image: String,
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    areTracksVisibleForAll: Boolean,
    hash: String,
    salt: String,
    needsEmailValidation: Boolean,
    verificationToken: String,
    resetToken: {
      token: String,
      expires: Date,
    },
  },
  { timestamps: true },
);

schema.plugin(uniqueValidator, { message: 'ist bereits vergeben. Sorry!' });

class User extends mongoose.Model {
  validPassword(password) {
    const hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
    return this.hash === hash;
  }

  setPassword(password) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hash = crypto.pbkdf2Sync(password, this.salt, 10000, 512, 'sha512').toString('hex');
  }

  generateJWT() {
    const today = new Date();
    const exp = new Date(today);
    exp.setDate(today.getDate() + 60);

    return jwt.sign(
      {
        id: this._id,
        username: this.username,
        exp: parseInt(exp.getTime() / 1000),
      },
      secret,
    );
  }

  toAuthJSON() {
    return {
      username: this.username,
      email: this.email,
      token: this.generateJWT(),
      bio: this.bio,
      image: this.image,
      areTracksVisibleForAll: this.areTracksVisibleForAll,
      apiKey: this._id,
    };
  }

  toProfileJSONFor(user) {
    return {
      username: this.username,
      bio: this.bio,
      image: this.image || 'https://static.productionready.io/images/smiley-cyrus.jpg',
      following: user ? user.isFollowing(this._id) : false,
    };
  }

  follow(id) {
    if (this.following.indexOf(id) === -1) {
      this.following.push(id);
    }

    return this.save();
  }

  unfollow(id) {
    this.following.remove(id);
    return this.save();
  }

  isFollowing(id) {
    return this.following.some(function (followId) {
      return followId.toString() === id.toString();
    });
  }
}

mongoose.model(User, schema);

module.exports = User;
