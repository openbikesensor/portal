const router = require('express').Router();
const passport = require('passport');
const { URL } = require('url');
const querystring = require('querystring');

const { AuthorizationCode, AccessToken, RefreshToken, Client } = require('../models');
const wrapRoute = require('../_helpers/wrapRoute');

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

router.post(
  '/login',
  passport.authenticate('usernameAndPasswordSession'),
  wrapRoute((req, res, next) => {
    if (!req.user) {
      return res.redirect('/login');
    }

    if (req.session.next) {
      res.redirect(req.session.next);
      req.session.next = null;
      return;
    }
    return res.type('html').end('You are logged in.');
  }),
);

router.get(
  '/login',
  wrapRoute(async (req, res) => {
    if (req.user) {
      return res.type('html').end('Already logged in, nothing to do.');
    }

    res
      .type('html')
      .end(
        '<form method="post"><input name="email" value="test@example.com" /><input type="password" name="password" value="hunter2" /><button type="submit">Login</button></form>',
      );
  }),
);

router.get(
  '/authorize',
  passport.authenticate('session'),
  wrapRoute(async (req, res) => {
    if (!req.user) {
      console.log(req);
      req.session.next = req.url;
      return res.redirect('/login');
    }

    try {
      const {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        scope = '*', // fallback to "all" scope
      } = req.query;

      // 1. Find our client and check if it exists
      if (!clientId) {
        return returnError(res, 'invalid_request', 'client_id parameter required');
      }

      const client = await Client.findOne({ clientId });
      if (!client) {
        return returnError(res, 'invalid_client', 'unknown client');
      }

      // 2. Check that we have a redirect_uri. In addition to [RFC6749] we
      // *always* require a redirect_uri.
      if (!redirectUri) {
        return returnError(res, 'invalid_request', 'redirect_uri parameter required');
      }

      // We enforce that the redirectUri exactly matches one of the provided URIs
      if (!client.validRedirectUris.includes(redirectUri)) {
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

      // 4. Get the scope.
      if (!isValidScope(scope)) {
        return redirectWithParams(res, redirectUri, {
          error: 'invalid_scope',
          error_description: 'the requested scope is not known',
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
      };

      res.type('html').end(`
          <p>
          You are about to confirm a login to client <code>${clientId}</code>
          with redirectUri <code>${redirectUri}</code> and scope <code>${scope}</code>.
          You have 2 minutes time for your decision.
          </p>

          <form method="post" action="/authorize/approve">
            <input type="submit" value="Authorize" />
          </form>
          <form method="post" action="/authorize/decline">
            <input type="submit" value="Decline" />
          </form>
      `);
    } catch (err) {
      console.error(err);
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

    const { clientId, redirectUri, scope, expiresAt } = req.session.authorizationTransaction;

    if (expiresAt < new Date().getTime()) {
      return res.status(400).type('html').end(`Your authorization has expired. Please go back and retry the process.`);
    }

    const client = await Client.findOne({ clientId });

    // invalidate the transaction
    req.session.authorizationTransaction = null;

    if (req.path === '/authorize/approve') {
      const code = AuthorizationCode.generate(client, req.user, redirectUri, scope);
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
      //
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

    if (!code) {
      return returnError(res, 'invalid_client', 'client_id parameter required');
    }

    if (!redirectUri) {
      return returnError(res, 'invalid_request', 'redirect_uri parameter required');
    }

    const client = await Client.findOne({ clientId });

    if (!client) {
      return returnError(res, 'invalid_client', 'invalid client_id');
    }

    const authorizationCode = await AuthorizationCode.findOne({ code });
    if ( !authorizationCode ) {
      console.log('no code found')
      return returnError(res, 'invalid_grant', 'invalid authorization code');
    }
    if (authorizationCode.redirectUri !== redirectUri) {
      console.log('redirect_uri mismatch')
      return returnError(res, 'invalid_grant', 'invalid authorization code');
    }
    if (authorizationCode.expiresAt <= new Date().getTime()) {
      console.log('expired')
      return returnError(res, 'invalid_grant', 'invalid authorization code');
    }
    if (!client._id.equals(authorizationCode.client)) {
      console.log('client mismatch', authorizationCode.client, client._id)
      return returnError(res, 'invalid_grant', 'invalid authorization code');
    }

    // invalidate auth code now, before generating tokens
    await AuthorizationCode.deleteOne({ _id: authorizationCode._id });

    const accessToken = AccessToken.generate(authorizationCode.client, authorizationCode.user, authorizationCode.scope);

    const refreshToken = RefreshToken.generate(
      authorizationCode.client,
      authorizationCode.user,
      authorizationCode.scope,
    );

    await Promise.all([accessToken.save(), refreshToken.save()]);

    return res.json({
      access_token: accessToken.token,
      token_type: 'Bearer',
      expires_in: Math.round((accessToken.expiresAt - new Date().getTime()) / 1000),
      refresh_token: refreshToken.token,
      scope: accessToken.scope,
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
    const baseUrl = 'http://localhost:3000';

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
