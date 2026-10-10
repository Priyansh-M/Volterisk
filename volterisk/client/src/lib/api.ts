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
  issues?: { path: string; message: string }[]

  constructor(message: string, status: number, code?: string, issues?: { path: string; message: string }[]) {
    super(message)
    this.status = status
    this.code = code
    this.issues = issues
  }
}

export function isMissing(err: unknown) {
  return err instanceof ApiError && (err.status === 404 || err.status === 501)
}

export function isBusy(err: unknown) {
  return err instanceof ApiError && (err.status === 503 || err.code === 'DB_BUSY' || err.code === 'BOOT')
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
  // Keep in-flight promises — clearing them duplicated requests and froze buys behind a stuck queue.
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

function shouldRetryBusy(status: number, code?: string) {
  // Only true busy/boot — not generic 500/502 HTML failures (those retry loops felt like lag).
  return status === 503 || code === 'DB_BUSY' || code === 'BOOT'
}

/**
 * Cap parallel GETs so a page load cannot open many Vercel isolates.
 * Mutations (buy/equip/etc.) bypass the queue — user actions must never freeze
 * behind desk polls or long busy backoffs.
 */
const MAX_PARALLEL_GETS = 2
let parallelGets = 0
const getWaiters: Array<() => void> = []

function acquireGetSlot(): Promise<void> {
  if (parallelGets < MAX_PARALLEL_GETS) {
    parallelGets += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    getWaiters.push(() => {
      parallelGets += 1
      resolve()
    })
  })
}

function releaseGetSlot() {
  parallelGets = Math.max(0, parallelGets - 1)
  const next = getWaiters.shift()
  if (next) next()
}

/**
 * Retry only on ledger-busy. Auth/validation/server bugs fail immediately.
 * GET slots are released during backoff so buys/UI are not frozen.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const method = (options.method ?? 'GET').toUpperCase()
  const isGet = method === 'GET'
  if (!isGet) invalidateGets()

  if (isGet) await acquireGetSlot()
  let holdingGet = isGet
  try {
    const maxAttempts = isGet ? 3 : 4
    let lastError: ApiError | null = null
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(requestUrl(path), { ...options, headers })
      const text = await response.text()
      let data: {
        error?: string | { code?: string; message?: string }
        code?: string
        issues?: { path: string; message: string }[]
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
      if (response.ok) return data as T
      const nested = data.error && typeof data.error === 'object' ? data.error : null
      const message = nested?.message || (typeof data.error === 'string' ? data.error : response.statusText)
      const code = nested?.code || data.code
      const detail = data.issues?.find((issue) => issue.message)?.message
      lastError = new ApiError(detail || message, response.status, code, data.issues)
      if (attempt + 1 < maxAttempts && shouldRetryBusy(response.status, code)) {
        if (holdingGet) {
          releaseGetSlot()
          holdingGet = false
        }
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt + Math.floor(Math.random() * 150)))
        if (isGet) {
          await acquireGetSlot()
          holdingGet = true
        }
        continue
      }
      throw lastError
    }
    throw lastError ?? new ApiError('Request failed', 500)
  } finally {
    if (holdingGet) releaseGetSlot()
  }
}
