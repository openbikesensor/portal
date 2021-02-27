const fs = require('fs');
const Joi = require('joi');

const configSchema = Joi.object({
  jwtSecret: Joi.string().min(16).max(128).required(),
  cookieSecret: Joi.string().min(16).max(128).required(),

  baseUrl: Joi.string().required(),
  mainFrontendUrl: Joi.string(), // optional

  mail: Joi.alternatives().try(
    Joi.object({
      from: Joi.string().required(),
      smtp: Joi.object({
        host: Joi.string().required(),
        port: Joi.number().default(587),
        username: Joi.string().required(),
        password: Joi.string().required(),
      }).required(),
    }),
    Joi.boolean().valid(false),
  ),

  mongodb: Joi.object({
    url: Joi.string().required(),
    debug: Joi.boolean().default(process.env.NODE_ENV !== 'production'),
  }).required(),
}).required();

const configFiles = [
  process.env.CONFIG_FILE,
  process.env.NODE_ENV === 'production' ? 'config.prod.json' : 'config.dev.json',
  'config.json',
].filter((x) => x && fs.existsSync(x));

if (!configFiles.length) {
  throw new Error('No config file found.');
}

module.exports = Joi.attempt(JSON.parse(fs.readFileSync(configFiles[0], 'utf8')), configSchema);
