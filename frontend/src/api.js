import {stringifyParams} from 'query'
import globalStore from 'store'
import {setAuth, invalidateAccessToken, resetAuth} from 'reducers/auth'
import {setLogin} from 'reducers/login'
import config from 'config.json'

class API {
  constructor(store) {
    this.store = store
    this._getValidAccessTokenPromise = null
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
    const url = new URL(config.auth.tokenEndpoint)
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
    const url = new URL(config.auth.tokenEndpoint)
    url.searchParams.append('code', code)
    url.searchParams.append('grant_type', 'authorization_code')
    url.searchParams.append('client_id', config.auth.clientId)
    url.searchParams.append('redirect_uri', config.auth.redirectUri)
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

  getLoginUrl() {
    const loginUrl = new URL(config.auth.authorizationEndpoint)
    loginUrl.searchParams.append('client_id', config.auth.clientId)
    loginUrl.searchParams.append('scope', config.auth.scope)
    loginUrl.searchParams.append('redirect_uri', config.auth.redirectUri)
    loginUrl.searchParams.append('response_type', 'code')

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

    if (response.status === 200) {
      return await response.json()
    } else {
      return null
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
      ...options,
      body,
      method: 'post',
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
