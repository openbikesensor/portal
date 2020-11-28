const jwt = require('express-jwt');
const secret = require('../config').secret;
const User = require('../models/User');

function getTokenFromHeader(req) {
  const authorization = req.headers.authorization;
  const [tokenType, token] = (authorization && authorization.split(' ')) || [];

  if (tokenType === 'Token' || tokenType === 'Bearer') {
    return token;
  }

  return null;
}

const jwtOptional = jwt({
  secret: secret,
  userProperty: 'authInfo',
  credentialsRequired: false,
  getToken: getTokenFromHeader,
  algorithms: ['HS256'],
});

async function getUserIdMiddleware(req, res, next) {
  try {
    const authorization = req.headers.authorization;
    const [tokenType, token] = (authorization && authorization.split(' ')) || [];

    if (tokenType === 'Token' || tokenType === 'Bearer') {
      // only parse the token as jwt if it looks like one, otherwise we get an error
      return jwtOptional(req, res, next);
    } else if (tokenType === 'OBSUserId') {
      req.authInfo = { id: token.trim() };
      next();
    } else if (!authorization && req.body && req.body.id && req.body.id.length === 24) {
      const user = await User.findById(req.body.id);
      if (user) {
        req.authInfo = { id: user.id };
        req.user = user;
      }
      next();
    } else {
      req.authInfo = null;
      next();
    }
  } catch (err) {
    next(err);
  }
}

async function loadUserMiddleware(req, res, next) {
  try {
    if (req.authInfo && req.authInfo.id) {
      req.user = await User.findById(req.authInfo.id);

      if (!req.user) {
        return res.sendStatus(401);
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  required(req, res, next) {
    if (!req.authInfo) {
      return res.sendStatus(403);
    } else {
      return next();
    }
  },
  optional(req, res, next) {
    return next();
  },
  getUserIdMiddleware,
  loadUserMiddleware,
};
