const BASE = '/api'

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.message || 'Something went wrong. Please try again.')
    this.status = status
    this.code = data?.code
    this.errors = data?.errors
  }
}

// The access token lives only in memory (never localStorage); the refresh token is an httpOnly cookie.
let accessToken = null
let onAuthLost = () => {}
let refreshing = null

export const setAccessToken = (token) => {
  accessToken = token
}
export const setAuthLostHandler = (fn) => {
  onAuthLost = fn
}

// Concurrent callers share one in-flight refresh: the server rotates refresh tokens,
// so firing two refreshes with the same cookie would look like token theft and log the user out.
export function refreshAccessToken() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new ApiError(res.status, data)
        accessToken = data.accessToken
        return data
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

async function request(path, options = {}, retried = false) {
  const { method = 'GET', body, auth = true } = options
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, { message: 'Cannot reach the server. Check your connection.' })
  }

  const data = await res.json().catch(() => null)
  if (res.ok) return data

  if (res.status === 401 && auth) {
    if (!retried && ['INVALID_TOKEN', 'NO_TOKEN'].includes(data?.code)) {
      try {
        await refreshAccessToken()
        return request(path, options, true)
      } catch {
        accessToken = null
        onAuthLost()
      }
    } else if (data?.code === 'USER_INACTIVE') {
      accessToken = null
      onAuthLost()
    }
  }
  throw new ApiError(res.status, data)
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body: body ?? {} }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body: body ?? {} }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body: body ?? {} }),
}
