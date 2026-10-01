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
let generation = 0

export function peek<T>(path: string): T | null {
  return memory.has(path) ? (memory.get(path) as T) : null
}

/** Drop cached GETs after a purchase so the next page does not paint an empty stall. */
export function invalidateGets() {
  generation += 1
  memory.clear()
  inflight.clear()
}

function fetchGet<T>(path: string): Promise<T> {
  const existing = inflight.get(path) as Promise<T> | undefined
  if (existing) return existing
  const gen = generation
  const pending = api<T>(path)
    .then((data) => {
      if (gen === generation) memory.set(path, data)
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

function requestUrl(path: string) {
  const base = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '')
  if (!base || /^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const method = (options.method ?? 'GET').toUpperCase()
  if (method !== 'GET') invalidateGets()
  const response = await fetch(requestUrl(path), { ...options, headers })
  const text = await response.text()
  let data: {
    error?: string | { code?: string; message?: string }
    code?: string
  } = {}
  if (text) {
    try {
      data = JSON.parse(text) as typeof data
    } catch {
      throw new ApiError(
        'The API did not answer. This site reached the page instead of /api.',
        response.status || 502,
      )
    }
  }
  if (!response.ok) {
    const nested = data.error && typeof data.error === 'object' ? data.error : null
    const message = nested?.message || (typeof data.error === 'string' ? data.error : response.statusText)
    const code = nested?.code || data.code
    throw new ApiError(message, response.status, code)
  }
  return data as T
}
