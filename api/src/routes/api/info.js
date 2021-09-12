const router = require('express').Router();

const { version } = require('../../../package.json');

router.route('/').get((req, res) => {
  res.json({
    version,
  });
});

module.exports = router;
