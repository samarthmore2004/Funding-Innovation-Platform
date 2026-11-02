import axios from 'axios'

export const TOKEN_KEY = 'rfip_token'
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

/** Token persistence wrapped in try/catch: storage can be unavailable (private mode, blocked site data). */
export const tokenStore = {
  get() {
    try {
      return window.localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable: the session will last until reload */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

const api = axios.create({ baseURL: API_BASE_URL, timeout: 90000 })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let unauthorizedHandler = null
/** Registered by AuthProvider so a 401 anywhere logs the user out and redirects to /login. */
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/token', '/auth/change-password', '/users/me/delete']

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url || ''
    const isAuthCall = AUTH_ENDPOINTS.some((path) => url.includes(path))
    if (status === 401 && !isAuthCall) {
      tokenStore.clear()
      if (unauthorizedHandler) unauthorizedHandler()
    }
    return Promise.reject(error)
  },
)

/** Drops empty values so optional filters are not sent as `param=`. */
export function cleanParams(params = {}) {
  const out = {}
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      if (value.length) out[key] = value.join(',')
      return
    }
    out[key] = value
  })
  return out
}

/** Turns axios/FastAPI errors (string detail or 422 validation arrays) into readable text. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  const response = error.response
  if (response) {
    const detail = response.data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (Array.isArray(detail) && detail.length) {
      return detail
        .map((item) => {
          const loc = Array.isArray(item?.loc)
            ? item.loc.filter((part) => !['body', 'query', 'path'].includes(part)).join('.')
            : ''
          const msg = item?.msg || 'Invalid value'
          return loc ? `${humanizeField(loc)}: ${msg}` : msg
        })
        .join(' · ')
    }
    if (detail && typeof detail === 'object' && detail.message) return String(detail.message)
    if (response.status === 403) return 'You do not have permission to perform this action.'
    if (response.status === 404) return 'The requested resource was not found.'
    if (response.status === 413) return 'The uploaded file is too large.'
    if (response.status === 429) return 'Too many requests. Please wait a moment and try again.'
    if (response.status >= 500) return 'The server encountered an error. Please try again later.'
  }
  if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.'
  if (error.message === 'Network Error') return 'Cannot reach the server. Check that the backend API is running.'
  return error.message || fallback
}

function humanizeField(loc) {
  return loc.replace(/_/g, ' ').replace(/\./g, ' › ')
}

/** Extracts a filename from a Content-Disposition header. */
function filenameFromDisposition(disposition) {
  if (!disposition) return null
  const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition)
  return plain ? plain[1].trim() : null
}

/**
 * Downloads a file from an authenticated endpoint (the JWT header rules out plain links).
 * Returns the filename that was saved.
 */
export async function downloadFile(url, params = {}, fallbackName = 'download') {
  try {
    const response = await api.get(url, { params: cleanParams(params), responseType: 'blob' })
    const filename = filenameFromDisposition(response.headers?.['content-disposition']) || fallbackName
    const blobUrl = URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000)
    return filename
  } catch (error) {
    // Error bodies of blob requests arrive as Blobs: decode them so getErrorMessage can read `detail`.
    const data = error?.response?.data
    if (data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await data.text())
      } catch {
        /* not JSON */
      }
    }
    throw error
  }
}

export default api
