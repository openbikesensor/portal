const wrapRoute = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    next(err);
  }
};

module.exports = wrapRoute;
