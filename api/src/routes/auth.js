const passport = require('passport')
const {LocalStrategy} = require('passport-local')
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
      req.authInfo = null;
      next();
    }
  } catch (err) {
    next(err);
  }
}

