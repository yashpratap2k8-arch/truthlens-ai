const TOKEN_KEY = 'truthlens_token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {}
}

// Resolve API base URL: defaults to '/api' for Vite dev proxy and Vercel production rewrites.
// Can be customized via VITE_API_BASE_URL (e.g., http://<LAPTOP_LAN_IP>:8000 for direct LAN testing).
const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
const API_BASE = rawBase ? (rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`) : '/api'

function buildUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${cleanPath}`
}

// Thin wrapper around fetch. Every function returns parsed JSON or throws Error(message).
async function request(path, options = {}) {
  const token = getToken()
  const headers = new Headers(options.headers || {})
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const targetUrl = buildUrl(path)
  let res
  try {
    res = await fetch(targetUrl, { ...options, headers })
  } catch {
    throw new Error('Cannot reach the server. Make sure the backend is running on port 8000.')
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    if (res.status === 401 && path === '/auth/me') {
      setToken(null)
    }
    const d = data && (data.detail || data.message)
    throw new Error(typeof d === 'string' ? d : `Request failed (HTTP ${res.status}).`)
  }
  return data
}

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  analyzeText: (text) => request('/analyze/text', json({ text })),
  analyzeUrl: (url) => request('/analyze/url', json({ url })),
  analyzeFile: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/analyze/file', { method: 'POST', body: form })
  },
  history: ({ limit, offset, verdict }) => {
    const q = new URLSearchParams({ limit, offset })
    if (verdict) q.set('verdict', verdict)
    return request('/history?' + q)
  },
  historyItem: (id) => request(`/history/${id}`),
  deleteItem: (id) => request(`/history/${id}`, { method: 'DELETE' }),
  clearHistory: () => request('/history', { method: 'DELETE' }),
  stats: () => request('/stats'),
  modelInfo: () => request('/model/info'),
  auth: {
    google: (credential) => request('/auth/google', json({ credential })),
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },
  ai: {
    chat: (message, context) => request('/ai/chat', json({ message, context })),
  },
  verification: {
    claim: (claim, context) => request('/verification/claim', json({ claim, context })),
    evidence: (query) => request('/verification/evidence', json({ query })),
    details: (id) => request(`/verification/${id}`),
  },
}
