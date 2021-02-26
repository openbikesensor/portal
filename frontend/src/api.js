import {stringifyParams} from 'query'
import globalStore from 'store'
import {setAuth, invalidateAccessToken, resetAuth} from 'reducers/auth'
import {setLogin} from 'reducers/login'
import config from 'config.json'
import {create as createPkce} from 'pkce'

class RequestError extends Error {
  constructor(message, errors) {
    super(message)
    this.errors = errors
  }
}

class API {
  constructor(store) {
    this.store = store
    this._getValidAccessTokenPromise = null
  }

  /**
   * Fetches or directly returns from cache the metadata information from the
   * authorization server, according to https://tools.ietf.org/html/rfc8414.
   * Also validates compatibility with this metadata server, i.e. checking that
   * it supports PKCE.
   */
  async getAuthorizationServerMetadata() {
    const url = new URL(config.auth.server)
    const pathSuffix = url.pathname.replace(/^\/+|\/+$/, '')
    url.pathname = '/.well-known/oauth-authorization-server' + (pathSuffix ? '/' + pathSuffix : '')

    const response = await window.fetch(url.toString())
    const metadata = await response.json()

    const {
      authorization_endpoint: authorizationEndpoint,
      token_endpoint: tokenEndpoint,
      response_types_supported: responseTypesSupported,
      code_challenge_methods_supported: codeChallengeMethodsSupported,
    } = metadata
    if (!authorizationEndpoint) {
      throw new Error('No authorization endpoint')
    }

    if (!authorizationEndpoint.startsWith(config.auth.server)) {
      throw new Error('Invalid authorization endpoint')
    }

    if (!tokenEndpoint) {
      throw new Error('No token endpoint')
    }

    if (!tokenEndpoint.startsWith(config.auth.server)) {
      throw new Error('Invalid token endpoint')
    }

    if (!Array.isArray(responseTypesSupported) || !responseTypesSupported.includes('code')) {
      throw new Error('Authorization code flow not supported or no support advertised.')
    }

    if (!Array.isArray(codeChallengeMethodsSupported) || !codeChallengeMethodsSupported.includes('S256')) {
      throw new Error('PKCE with S256 not supported or no support advertised.')
    }

    return {authorizationEndpoint, tokenEndpoint}
  }

  /**
   * Return an access token, if it is (still) valid. If not, and a refresh
   * token exists, use the refresh token to issue a new access token. If that
   * fails, or neither is available, return `null`. This should usually result
   * in a redirect to login.
   */
  async getValidAccessToken() {
    // prevent multiple parallel refresh processes
    if (this._getValidAccessTokenPromise) {
      return await this._getValidAccessTokenPromise
    } else {
      this._getValidAccessTokenPromise = this._getValidAccessToken()
      const result = await this._getValidAccessTokenPromise
      this._getValidAccessTokenPromise = null
      return result
    }
  }

  async _getValidAccessToken() {
    let {auth} = this.store.getState()

    if (!auth) {
      return null
    }

    const {tokenType, accessToken, refreshToken, expiresAt} = auth

    // access token is valid
    if (accessToken && expiresAt > new Date().getTime()) {
      return `${tokenType} ${accessToken}`
    }

    if (!refreshToken) {
      return null
    }

    //  Try to use the refresh token
    const {tokenEndpoint} = await this.getAuthorizationServerMetadata()
    const url = new URL(tokenEndpoint)
    url.searchParams.append('refresh_token', refreshToken)
    url.searchParams.append('grant_type', 'refresh_token')
    url.searchParams.append('scope', config.auth.scope)
    const response = await window.fetch(url.toString())
    const json = await response.json()

    if (response.status === 200 && json != null && json.error == null) {
      auth = this.getAuthFromTokenResponse(json)
      this.store.dispatch(setAuth(auth))
      return `${auth.tokenType} ${auth.accessToken}`
    } else {
      console.warn('Could not use refresh token, error response:', json)
      this.store.dispatch(resetAuth())
      return null
    }
  }

  async exchangeAuthorizationCode(code) {
    const codeVerifier = localStorage.getItem('codeVerifier');
    if (!codeVerifier) {
      throw new Error("No code verifier found");
    }

    const {tokenEndpoint} = await this.getAuthorizationServerMetadata()
    const url = new URL(tokenEndpoint)
    url.searchParams.append('code', code)
    url.searchParams.append('grant_type', 'authorization_code')
    url.searchParams.append('client_id', config.auth.clientId)
    url.searchParams.append('redirect_uri', config.auth.redirectUri)
    url.searchParams.append('code_verifier', codeVerifier)
    const response = await window.fetch(url.toString())
    const json = await response.json()

    if (json.error) {
      return json
    }

    const auth = api.getAuthFromTokenResponse(json)
    this.store.dispatch(setAuth(auth))

    const {user} = await this.get('/user')
    this.store.dispatch(setLogin(user))

    return true
  }

  async makeLoginUrl() {
    const {authorizationEndpoint} = await this.getAuthorizationServerMetadata()

    const {codeVerifier, codeChallenge} = createPkce()
    localStorage.setItem("codeVerifier", codeVerifier);

    const loginUrl = new URL(authorizationEndpoint)
    loginUrl.searchParams.append('client_id', config.auth.clientId)
    loginUrl.searchParams.append('scope', config.auth.scope)
    loginUrl.searchParams.append('redirect_uri', config.auth.redirectUri)
    loginUrl.searchParams.append('response_type', 'code')
    loginUrl.searchParams.append('code_challenge', codeChallenge)
    loginUrl.searchParams.append('code_challenge_method', 'S256')

    // TODO: Implement PKCE

    return loginUrl.toString()
  }

  async fetch(url, options = {}) {
    const accessToken = await this.getValidAccessToken()

    const response = await window.fetch('/api' + url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: accessToken,
      },
    })

    if (response.status === 401) {
      // Unset login, since 401 means that we're not logged in. On the next
      // request with `getValidAccessToken()`, this will be detected and the
      // refresh token is used (if still valid).
      this.store.dispatch(invalidateAccessToken())

      throw new Error('401 Unauthorized')
    }

    let json
      try {
        json = await response.json()
      } catch (err) {
        json = null
      }

    if (response.status === 200) {
      return json
    } else if (response.status === 204) {
      return null
    } else {
      throw new RequestError('Error code ' + response.status, json?.errors)
    }
  }

  async post(url, {body: body_, ...options}) {
    let body = body_
    let headers = {...(options.headers || {})}

    if (!(typeof body === 'string' || body instanceof FormData)) {
      body = JSON.stringify(body)
      headers['Content-Type'] = 'application/json'
    }

    return await this.fetch(url, {
      method: 'post',
      ...options,
      body,
      headers,
    })
  }

  async get(url, {query, ...options} = {}) {
    const queryString = query ? stringifyParams(query) : null
    return await this.fetch(url + (queryString ? '?' + queryString : ''), {method: 'get', ...options})
  }

  async delete(url, options = {}) {
    return await this.get(url, {...options, method: 'delete'})
  }

  async put(url, options = {}) {
    return await this.post(url, {...options, method: 'put'})
  }

  getAuthFromTokenResponse(tokenResponse) {
    return {
      tokenType: tokenResponse.token_type,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: new Date().getTime() + tokenResponse.expires_in * 1000,
      scope: tokenResponse.scope,
    }
  }
}

const api = new API(globalStore)

export default api
