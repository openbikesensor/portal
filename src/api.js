import {stringifyParams} from 'query'

class API {
  setAuthorizationHeader(authorization) {
    this.authorization = authorization
  }

  async fetch(url, options = {}) {
    const response = await window.fetch('/api' + url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: this.authorization,
      },
    })

    if (response.status === 200) {
      return await response.json()
    } else {
      return null
    }
  }

  async post(url, {body: body_, ...options}) {
    const body = typeof body_ !== 'string' ? JSON.stringify(body_) : body_
    return await this.fetch(url, {...options, body, method: 'post',
      headers: {
        ...(options.headers || {}),
        'Content-Type': 'application/json',
      },
    })
  }

  async get(url, {query, ...options} = {}) {
    const queryString = query ? stringifyParams(query) : null
    return await this.fetch(url + (queryString ? '?' + queryString : ''), {method: 'get', ...options})
  }

  async delete(url, options = {}) {
    return await this.get(url,  {...options, method: 'delete'})
  }
}

const api = new API()

export default api
