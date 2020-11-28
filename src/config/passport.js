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
    async function (email, password, done) {
      try {
        const user = await User.findOne({ email: email });
        if (!user || !user.validPassword(password)) {
          return done(null, false, { errors: { 'email or password': 'is invalid' } });
        }

        if (user.needsEmailValidation) {
          return done(null, false, { errors: { 'E-Mail-Bestätigung': 'noch nicht erfolgt' } });
        }

        return done(null, user);
      } catch (err) {
        done(err);
      }
    },
  ),
);
