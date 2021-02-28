const router = require('express').Router();
const passport = require('passport');
const { URL } = require('url');
const { createChallenge } = require('pkce');

const { AuthorizationCode, AccessToken, RefreshToken } = require('../models');
const auth = require('../passport');
const wrapRoute = require('../_helpers/wrapRoute');
const config = require('../config');

const baseUrl = config.baseUrl.replace(/\/+$/, '');


// Check whether the "bigScope" fully includes the "smallScope".
function scopeIncludes(smallScope, bigScope) {
  const smallScopeParts = smallScope.split(/\s/);
  const bigScopeParts = bigScope.split(/\s/);
  return bigScopeParts.includes('*') || smallScopeParts.every((part) => bigScopeParts.includes(part));
}

function returnError(res, error, errorDescription = undefined, status = 400) {
  return res
    .status(status)
    .json({ error, ...(errorDescription != null ? { error_description: errorDescription } : {}) });
}

function redirectWithParams(res, redirectUri, params) {
  const targetUrl = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    targetUrl.searchParams.append(key, value);
  }
  return res.redirect(targetUrl.toString());
}

const ALL_SCOPE_NAMES = `
  tracks.create
  tracks.update
  tracks.list
  tracks.show
  tracks.delete
  users.update
  users.show
  tracks.comments.create
  tracks.comments.update
  tracks.comments.list
  tracks.comments.show
`.split(/\s/);

function isValidScope(scope) {
  return scope === '*' || scopeIncludes(scope, ALL_SCOPE_NAMES.join(' '));
}

router.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.mainFrontendUrl = config.mainFrontendUrl;
  res.locals.baseUrl = baseUrl;
  next();
});

router.post(
  '/login',
  passport.authenticate('usernameAndPasswordSession', { session: true }),
  (err, req, res, next) => {
    if (!err) {
      next();
    }

    if (err.message === 'invalid credentials') {
      return res.render('login', { badCredentials: true });
    }

    let description = 'Unknown error while processing your login.';
    if (err.message === 'email not verified') {
      description = 'Your account is not yet verified, please check your email or start the password recovery.';
    }

    return res.render('message', { type: 'error', title: 'Login failed', description });
  },
  wrapRoute((req, res, next) => {
    if (!req.user) {
      return res.redirect(baseUrl + '/login');
    }

    if (req.session.next) {
      res.redirect(req.session.next);
      req.session.next = null;
      return;
    }
    return res.render('message', { type: 'success', title: 'You are logged in.' });
  }),
);

router.get(
  '/login',
  wrapRoute(async (req, res) => {
    if (req.user) {
      return res.render('message', { type: 'success', title: 'You are already logged in.' });
    }

    return res.render('login');
  }),
);

router
  .route('/logout')
  .post(
    auth.usernameAndPasswordSession,
    wrapRoute(async (req, res) => {
      req.logout();
      return res.redirect(baseUrl + '/login');
    }),
  )
  .get((req, res) => res.render('logout'));

const isIp = (ip) =>
  typeof ip === 'string' &&
  /^([0-9]{1,3}\.)[0-9]{1,3}$/.test(ip) &&
  ip
    .split('.')
    .every(
      (num, idx) =>
        !num.startsWith('0') && Number(num) > (idx === 0 || idx === 3 ? 1 : 0) && Number(num) < (idx === 3 ? 254 : 255),
    );

const isLocalIp = (ip) => isIp(ip) && (ip.startsWith('10.') || ip.startsWith('172.16.') || ip.startsWith('192.168.'));

const isValidRedirectUriFor = (redirectUri) => (redirectUriPattern) => {
  // Here we have an exception to the security requirements demanded by
  // https://tools.ietf.org/html/draft-ietf-oauth-security-topics-16#section-2.1,
  // namely, that we do not always require fully specified redirect URIs. This
  // is because we cannot know beforehand which IP the OBS will be running at.
  // But since it is usually accessed via local IP, we can allow all local IP
  // ranges. This special case must only be used in clients that have a very
  // restricted `maxScope` as well, to prevent misuse should an attack through
  // this be successful.
  // This special case does however enforce TLS ("https://"), for it prevents
  // usage in a non-TLS-secured web server. At least passive sniffing of the
  // token is not possible then. A self-signed and manually verified
  // certificate should be used for this (though usually we cannot enforce the
  // actual verification).
  if (redirectUriPattern === '__LOCAL__') {
    const url = new URL(redirectUri);
    if (url.protocol === 'https:' && isLocalIp(url.host) && !url.search && !url.hash) {
      return true;
    }
    return false;
  } else {
    return redirectUriPattern === redirectUri;
  }
};

router.get(
  '/authorize',
  passport.authenticate('session'),
  wrapRoute(async (req, res) => {
    if (!req.user) {
      req.session.next = req.url;
      return res.redirect(baseUrl + '/login');
    }

    try {
      const {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        scope = '*', // fallback to "all" scope
        // for PKCE
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
      } = req.query;

      // 1. Find our client and check if it exists
      if (!clientId) {
        return returnError(res, 'invalid_request', 'client_id parameter required');
      }

      const client = await config.oAuth2Clients.find((c) => c.clientId === clientId);
      if (!client) {
        return returnError(res, 'invalid_client', 'unknown client');
      }

      // 2. Check that we have a redirect_uri. In addition to [RFC6749] we
      // *always* require a redirect_uri.
      if (!redirectUri) {
        return returnError(res, 'invalid_request', 'redirect_uri parameter required');
      }

      // We enforce that the redirectUri exactly matches one of the provided URIs
      const check = isValidRedirectUriFor(redirectUri);
      if (!client.validRedirectUris.some(check)) {
        return returnError(res, 'invalid_request', 'invalid redirect_uri');
      }

      // 3. Find out which type of response to use.  [RFC6749] requires one of
      // "code" or "token", but "token" is implicit grant and we do not support
      // that.

      if (responseType !== 'code') {
        return redirectWithParams(res, redirectUri, {
          error: 'unsupported_grant_type',
          error_description: 'only authorization code flow with PKCE is supported by this server',
        });
      }

      // 4. Verify we're using PKCE with supported (S256) code_challenge_method.
      if (!codeChallenge) {
        return redirectWithParams(res, redirectUri, {
          error: 'invalid_request',
          error_description: 'a code_challenge for PKCE is required',
        });
      }

      if (codeChallengeMethod !== 'S256') {
        return redirectWithParams(res, redirectUri, {
          error: 'invalid_request',
          error_description: 'the code_challenge_method for PKCE must be "S256"',
        });
      }

      // 5. Get the scope.
      if (!isValidScope(scope)) {
        return redirectWithParams(res, redirectUri, {
          error: 'invalid_scope',
          error_description: 'the requested scope is not known',
        });
      }

      if (client.maxScope && !scopeIncludes(scope, client.maxScope)) {
        return redirectWithParams(res, redirectUri, {
          error: 'access_denied',
          error_description: 'the requested scope is not valid for this client',
        });
      }

      // Ok, let's save all this in the session, and show a dialog for the
      // decision to the user.

      req.session.authorizationTransaction = {
        responseType,
        clientId,
        redirectUri,
        scope,
        expiresAt: new Date().getTime() + 1000 * 60 * 2, // 2 minute decision time
        codeChallenge,
      };

      res.render('authorize', { clientTitle: client.title, scope, redirectUri });
    } catch (err) {
      res.status(400).json({ error: 'invalid_request', error_description: 'unknown error' });
    }
  }),
);

router.post(
  ['/authorize/approve', '/authorize/decline'],
  passport.authenticate('session'),
  wrapRoute(async (req, res) => {
    if (!req.session.authorizationTransaction) {
      return res.sendStatus(400);
    }

    if (!req.user) {
      return res.sendStatus(400);
    }

    const { clientId, redirectUri, scope, expiresAt, codeChallenge } = req.session.authorizationTransaction;

    if (expiresAt < new Date().getTime()) {
      return res.status(400).render('message', {
        type: 'error',
        title: 'Expired',
        description: 'Your authorization has expired. Please go back and retry the process.',
      });
    }

    // invalidate the transaction
    req.session.authorizationTransaction = null;

    if (req.path === '/authorize/approve') {
      const code = AuthorizationCode.generate({
        clientId,
        user: req.user,
        redirectUri,
        scope,
        codeChallenge,
      });
      await code.save();

      return redirectWithParams(res, redirectUri, { code: code.code, scope });
    } else {
      return redirectWithParams(res, redirectUri, { error: 'access_denied' });
    }
  }),
);

/**
 * This function is called when the client presents an authorization code
 * (generated above) and wants it turned into an access (and possibly refresh)
 * token.
 */
router.get(
  '/token',
  wrapRoute(async (req, res) => {
    const {
      grant_type: grantType,
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      // for PKCE
      code_verifier: codeVerifier,
    } = req.query;

    if (!grantType || grantType !== 'authorization_code') {
      return returnError(
        res,
        'unsupported_grant_type',
        'only authorization code flow with PKCE is supported by this server',
      );
    }

    if (!code) {
      return returnError(res, 'invalid_request', 'code parameter required');
    }

    // Call this function to destroy the authorization code (if it exists),
    // invalidating it when a single failed request has been received. The
    // whole process must be restarted. No trial and error ;)
    const destroyAuthCode = async () => {
      await AuthorizationCode.deleteOne({ code });
    };

    if (!clientId) {
      await destroyAuthCode();
      return returnError(res, 'invalid_client', 'client_id parameter required');
    }

    if (!redirectUri) {
      await destroyAuthCode();
      return returnError(res, 'invalid_request', 'redirect_uri parameter required');
    }

    if (!codeVerifier) {
      await destroyAuthCode();
      return returnError(res, 'invalid_request', 'code_verifier parameter required');
    }

    const client = await config.oAuth2Clients.find((c) => c.clientId === clientId);

    if (!client) {
      await destroyAuthCode();
      return returnError(res, 'invalid_client', 'invalid client_id');
    }

    const authorizationCode = await AuthorizationCode.findOne({ code });
    if (!authorizationCode) {
      await destroyAuthCode();
      return returnError(res, 'invalid_grant', 'invalid authorization code');
    }
    if (authorizationCode.redirectUri !== redirectUri) {
      await destroyAuthCode();
      return returnError(res, 'invalid_grant', 'invalid authorization code');
    }
    if (authorizationCode.expiresAt <= new Date().getTime()) {
      await destroyAuthCode();
      return returnError(res, 'invalid_grant', 'invalid authorization code');
    }
    if (clientId !== authorizationCode.clientId) {
      await destroyAuthCode();
      return returnError(res, 'invalid_grant', 'invalid authorization code');
    }
    if (createChallenge(codeVerifier) !== authorizationCode.codeChallenge) {
      await destroyAuthCode();
      return returnError(res, 'invalid_grant', 'invalid authorization code');
    }

    // invalidate auth code now, before generating tokens
    await AuthorizationCode.deleteOne({ _id: authorizationCode._id });

    const accessToken = AccessToken.generate({
      clientId: authorizationCode.clientId,
      user: authorizationCode.user,
      scope: authorizationCode.scope,
    });
    await accessToken.save();

    let refreshToken;
    if (client.refreshTokenExpirySeconds != null) {
      refreshToken = RefreshToken.generate(
        {
          clientId: authorizationCode.clientId,
          user: authorizationCode.user,
          scope: authorizationCode.scope,
        },
        client.refreshTokenExpirySeconds,
      );
      await refreshToken.save();
    }

    return res.json({
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: Math.round((accessToken.expiresAt - new Date().getTime()) / 1000),
      scope: accessToken.scope,
      ...(refreshToken != null ? { refresh_token: refreshToken.token } : {}),
    });
  }),
);

/**
 * Metadata endpoint to inform clients about authorization server capabilities,
 * according to https://tools.ietf.org/html/rfc8414.
 */
router.get(
  '/.well-known/oauth-authorization-server',
  wrapRoute(async (req, res) => {
    return res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      token_endpoint_auth_methods_supported: ['none'], // only public clients
      userinfo_endpoint: `${baseUrl}/api/user`,
      // registration_endpoint: `${baseUrl}/register`, // TODO
      // scopes_supported: ALL_SCOPE_NAMES, // TODO
      response_types_supported: ['code'], // only auth code, no implicit flow or
      service_documentation: 'https://github.com/openbikesensor/portal',
      ui_locales_supported: ['en-US', 'en-GB', 'en-CA', 'fr-FR', 'fr-CA'],
      code_challenge_methods_supported: ['S256'],
    });
  }),
);

module.exports = router;

const accountService = require('../accounts/account.service');
const validateRequest = require('../_middleware/validate-request');
const Joi = require('joi');

router
  .route('/register')
  .post(
    validateRequest(
      Joi.object({
        username: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
      }),
    ),
    wrapRoute(async (req, res) => {
      await accountService.register(req.body, req.get('origin'));

      return res.render('message', {
        type: 'success',
        title: 'Registration successful',
        description: 'Please check your email for verification instructions.',
      });
    }),
  )
  .get((req, res) => res.render('register'));

router.get(
  '/verify-email',
  validateRequest(
    Joi.object({
      token: Joi.string().required(),
    }),
    'query',
  ),
  wrapRoute(async (req, res) => {
    await accountService.verifyEmail(req.query);
    return res.render('message', {
      type: 'success',
      title: 'Verification successful',
      description: 'You can now log in.',
      showLoginButton: true,
    });
  }),
);

router
  .route('/forgot-password')
  .post(
    validateRequest(
      Joi.object({
        email: Joi.string().email().required(),
      }),
    ),
    wrapRoute(async (req, res) => {
      await accountService.forgotPassword(req.body, req.get('origin'));
      res.render('message', {
        type: 'success',
        title: 'Recovery mail sent',
        description: 'Please check your inbox for password recovery instructions.',
      });
    }),
  )
  .get((req, res) => res.render('forgot-password'));

router
  .route('/reset-password')
  .post(
    validateRequest(
      Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
      }),
    ),
    wrapRoute(async (req, res) => {
      await accountService.resetPassword(req.body);
      return res.render('message', {
        type: 'success',
        title: 'Password reset successful',
        description: 'You can now log in.',
        showLoginButton: true,
      });
    }),
  )
  .get(
    validateRequest(
      Joi.object({
        token: Joi.string().required(),
      }),
      'query',
    ),
    wrapRoute(async (req, res) => {
      const { token } = req.query;
      await accountService.validateResetToken({ token });
      res.render('reset-password', { token });
    }),
  );

module.exports = router;
