import {stringifyParams} from 'query'
import globalStore from 'store'
import {setLogin} from 'reducers/login'
import configPromise from 'config'
import download from 'downloadjs'

function getFileNameFromContentDispostionHeader(contentDisposition) {
  const standardPattern = /filename=(["']?)(.+)\1/i
  const wrongPattern = /filename=([^"'][^;"'\n]+)/i

  if (standardPattern.test(contentDisposition)) {
    return contentDisposition.match(standardPattern)[2]
  }

  if (wrongPattern.test(contentDisposition)) {
    return contentDisposition.match(wrongPattern)[1]
  }
}

class RequestError extends Error {
  constructor(message, errors) {
    super(message)
    this.errors = errors
  }
}

class API {
  constructor(store) {
    this.store = store
  }

  async loadUser() {
    try {
      const result = await this.get('/user')
      this.store.dispatch(setLogin(result))
    } catch {
      this.store.dispatch(setLogin(null))
    }
  }

  async logout() {
    const config = await configPromise
    const url = new URL(config.apiUrl + '/logout')
    url.searchParams.append('next', window.location.href) // bring us back to the current page
    window.location.href = url.toString()
  }

  async makeLoginUrl() {
    const config = await configPromise
    const url = new URL(config.loginUrl || config.apiUrl + '/login')
    url.searchParams.append('next', window.location.href) // bring us back to the current page
    return url.toString()
  }

  async fetch(url, options = {}) {
    const config = await configPromise

    const {returnResponse = false, ...fetchOptions} = options

    const response = await window.fetch(config.apiUrl + url, {
      ...fetchOptions,
      credentials: 'include',
    })

    if (response.status === 401) {
      throw new Error('401 Unauthorized')
    }

    if (returnResponse) {
      if (response.status === 200) {
        return response
      } else if (response.status === 204) {
        return null
      } else {
        throw new RequestError('Error code ' + response.status)
      }
    }

    let json
    try {
      json = await response.json()
    } catch (err) {
      console.warn(err)
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

  async downloadFile(url, options = {}) {
    const res = await this.fetch(url, {returnResponse: true, ...options})
    const blob = await res.blob()
    const filename = getFileNameFromContentDispostionHeader(res.headers.get('content-disposition'))
    const contentType = res.headers.get('content-type')

    // Apparently this workaround is needed for some browsers
    const newBlob = new Blob([blob], {type: contentType})

    download(newBlob, filename, contentType)
  }
}

const api = new API(globalStore)

export default api
