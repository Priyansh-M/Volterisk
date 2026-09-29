const TOKEN_KEY = 'iron-hour-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function isMissing(err: unknown) {
  return err instanceof ApiError && (err.status === 404 || err.status === 501)
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(path, { ...options, headers })
  const data = (await response.json().catch(() => ({}))) as {
    error?: string | { code?: string; message?: string }
    code?: string
  }
  if (!response.ok) {
    const nested = data.error && typeof data.error === 'object' ? data.error : null
    const message = nested?.message || (typeof data.error === 'string' ? data.error : response.statusText)
    const code = nested?.code || data.code
    throw new ApiError(message, response.status, code)
  }
  return data as T
}
