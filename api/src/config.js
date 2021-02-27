const fs = require('fs');
const Joi = require('joi');

const configSchema = Joi.object()
  .required()
  .keys({
    jwtSecret: Joi.string().min(16).max(128).required(),
    cookieSecret: Joi.string().min(16).max(128).required(),

    mail: Joi.alternatives().try(
      Joi.object({
        from: Joi.string().required(),
        smtp: Joi.object().required().keys({
          host: Joi.string().required(),
          port: Joi.number().default(587),
          username: Joi.string().required(),
          password: Joi.string().required(),
        }),
      }),
      Joi.boolean().valid(false),
    ),
  });

const configFiles = [
  process.env.CONFIG_FILE,
  process.env.NODE_ENV === 'production' ? 'config.prod.json' : 'config.dev.json',
  'config.json',
].filter((x) => x && fs.existsSync(x));

if (!configFiles.length) {
  throw new Error('No config file found.');
}

module.exports = Joi.attempt(JSON.parse(fs.readFileSync(configFiles[0], 'utf8')), configSchema);
