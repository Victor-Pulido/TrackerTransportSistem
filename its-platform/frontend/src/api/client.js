import axios from 'axios'

const client = axios.create({
  baseURL: '/',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: inject Bearer token ──────────────────────────────
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('its_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor: handle 401 ─────────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('its_token')
      localStorage.removeItem('its_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
