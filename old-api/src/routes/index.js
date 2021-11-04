const router = require('express').Router();

router.use('/api', require('./api'));

// no prefix
router.use(require('./auth'));

module.exports = router;
