import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${API_URL}/api/v1`,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: false,
  })

  // Inject JWT on every request
  client.interceptors.request.use(config => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  })

  // Handle 401 — redirect to login
  client.interceptors.response.use(
    response => response,
    async error => {
      if (error.response?.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
      return Promise.reject(error)
    },
  )

  return client
}

export const api = createApiClient()

// Typed helper functions
export async function apiGet<T>(url: string, params?: Record<string, unknown>) {
  const res = await api.get<{ data: T }>(url, { params })
  return res.data
}

export async function apiPost<T>(url: string, data?: unknown) {
  const res = await api.post<{ data: T }>(url, data)
  return res.data
}

export async function apiPatch<T>(url: string, data?: unknown) {
  const res = await api.patch<{ data: T }>(url, data)
  return res.data
}

export async function apiDelete(url: string) {
  return api.delete(url)
}
