const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const User = mongoose.model('User');

passport.use(
  new LocalStrategy(
    {
      usernameField: 'user[email]',
      passwordField: 'user[password]',
    },
    function (email, password, done) {
      User.findOne({ email: email })
        .then(function (user) {
          if (!user || !user.validPassword(password)) {
            return done(null, false, { errors: { 'email or password': 'is invalid' } });
          }

          if (user && user.needsEmailValidation) {
            return done(null, false, { errors: { 'E-Mail-Bestätigung': 'noch nicht erfolgt' } });
          }

          return done(null, user);
        })
        .catch(done);
    },
  ),
);
