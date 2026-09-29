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

const memory = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

export function peek<T>(path: string): T | null {
  return memory.has(path) ? (memory.get(path) as T) : null
}

function fetchGet<T>(path: string): Promise<T> {
  const existing = inflight.get(path) as Promise<T> | undefined
  if (existing) return existing
  const pending = api<T>(path)
    .then((data) => {
      memory.set(path, data)
      return data
    })
    .finally(() => {
      if (inflight.get(path) === pending) inflight.delete(path)
    })
  inflight.set(path, pending)
  return pending
}

/** Start a GET before the page opens. Shares one request with the page. */
export function prefetch(path: string) {
  if (memory.has(path) || inflight.has(path)) return
  void fetchGet(path).catch(() => undefined)
}

export function load<T>(path: string): Promise<T> {
  return fetchGet<T>(path)
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
