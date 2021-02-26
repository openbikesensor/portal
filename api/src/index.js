const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const errorhandler = require('errorhandler');
const passport = require('passport');

require('./config/passport');

const isProduction = process.env.NODE_ENV === 'production';

// Create global app object
const app = express();

app.use(cors());

// Express configuration
app.set('views', './views');
app.set('view engine', 'pug');

// Normal express config defaults
app.use(require('morgan')('dev'));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));

app.use(require('method-override')());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({ secret: 'obsobs', cookie: { maxAge: 10 * 60 * 1000 }, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

if (!isProduction) {
  app.use(errorhandler());
}

require('./db');

app.use(require('./routes'));

/// catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (!isProduction) {
  app.use(function (err, req, res, next) {
    console.log(err.stack);

    res.status(err.status || 500);

    res.json({
      errors: {
        message: err.message,
        error: err,
      },
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    errors: {
      message: err.message,
      error: {},
    },
  });
});

// finally, let's start our server...
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('Listening on port ' + port);
});
