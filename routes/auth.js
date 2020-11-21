const jwt = require('express-jwt');
const secret = require('../config').secret;

function getTokenFromHeader(req) {
  const [tokenType, token] = req.headers.authorization?.split(' ') || [];

  if (tokenType === 'Token' || tokenType === 'Bearer') {
    return token;
  }

  return null;
}

const jwtOptional = jwt({
  secret: secret,
  userProperty: 'payload',
  credentialsRequired: false,
  getToken: getTokenFromHeader,
  algorithms: ['HS256'],
});

function getUserIdMiddleware(req, res, next) {
  try {
    const [tokenType, token] = req.headers.authorization.split(' ') || [];

    if (tokenType === 'Token' || tokenType === 'Bearer') {
      return jwtOptional(req, res, next);
    } else if (tokenType === 'OBSUserId') {
      req.payload = { id: token.trim() };
      next();
    } else {
      req.payload = null;
      next();
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  required(req, res, next) {
    if (!req.payload) {
      return res.sendStatus(403);
    } else {
      return next();
    }
  },
  optional(req, res, next) {
    return next();
  },
  getUserIdMiddleware,
};
