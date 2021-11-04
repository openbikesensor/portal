const validateRequest = (schema, property = 'body') => (req, res, next) => {
  console.log('validateRequest');

  const options = {
    abortEarly: false, // include all errors
    allowUnknown: true, // ignore unknown props
    stripUnknown: true, // remove unknown props
  };
  const { error, value } = schema.validate(req[property], options);
  if (error) {
    console.log('error: ', error);
    next(`Validation error: ${error.details.map((x) => x.message).join(', ')}`);
  } else {
    req[property] = value;
    next();
  }
};

module.exports = validateRequest;
