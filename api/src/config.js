const fs = require('fs');
const Joi = require('joi');

const configSchema = Joi.object({
  jwtSecret: Joi.string().min(16).max(128).required(),
  cookieSecret: Joi.string().min(16).max(128).required(),

  imprintUrl: Joi.string(),
  privacyPolicyUrl: Joi.string(),

  baseUrl: Joi.string().required(),
  mainFrontendUrl: Joi.string(), // optional

  mail: Joi.alternatives().try(
    Joi.object({
      from: Joi.string().required(),
      smtp: Joi.object({
        host: Joi.string().required(),
        port: Joi.number().default(465),
        starttls: Joi.boolean().default(false),
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

  redisUrl: Joi.string().required(),

  oAuth2Clients: Joi.array()
    .default([])
    .items(
      Joi.object({
        title: Joi.string().required(),
        clientId: Joi.string().required(),
        validRedirectUris: Joi.array().required().items(Joi.string()),

        // Set `refreshTokenExpirySeconds` to null to issue no refresh tokens.  Set
        // to a number of seconds to issue refresh tokens with that duration. No
        // infinite tokens are ever issued, set to big number to simulate that.
        refreshTokenExpirySeconds: Joi.number()
          .default(null)
          .min(1) // 0 would make no sense, use `null` to issue no token
          .max(1000 * 24 * 60 * 60), // 1000 days, nearly 3 years

        // Set to a scope which cannot be exceeded when requesting client tokens.
        // Clients must manually request a scope that is smaller or equal to this
        // scope to get a valid response. Scopes are not automatically truncated.
        // Leave empty or set to `"*"` for unlimited scopes in this client.
        maxScope: Joi.string().required(),

        autoAccept: Joi.boolean().optional(),
      }),
    ),
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
