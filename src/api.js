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

    return await response.json()
  }
}

const api = new API()

export default api
