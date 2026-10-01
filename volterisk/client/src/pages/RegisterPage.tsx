import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import type { Profile } from '../lib/types.ts'
import { AuthLayout } from './AuthLayout.tsx'

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 .'_-]*$/

function nameProblem(raw: string): string | null {
  const name = raw.trim()
  if (!name) return null
  if (name.length < 3 || name.length > 24) return 'Name needs 3 to 24 characters.'
  if (!NAME_RE.test(name)) return 'Use letters, numbers, spaces, apostrophes, hyphens, or underscores.'
  return null
}

function passwordProblem(raw: string): string | null {
  if (!raw) return null
  if (raw.length < 8) return 'Password needs eight characters.'
  if (raw.length > 72) return 'Password can be at most 72 characters.'
  return null
}

export function RegisterPage() {
  const { me, loading, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [nameState, setNameState] = useState<'idle' | 'free' | 'taken'>('idle')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (nameProblem(username) || username.trim().length < 3) {
      setNameState('idle')
      return
    }
    const name = username.trim()
    let cancelled = false
    const handle = window.setTimeout(() => {
      void api<{ available: boolean }>(`/api/auth/name?username=${encodeURIComponent(name)}`)
        .then((row) => {
          if (!cancelled) setNameState(row.available ? 'free' : 'taken')
        })
        .catch(() => {
          if (!cancelled) setNameState('idle')
        })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [username])

  if (!loading && me?.onboarding) return <Navigate to={me.onboarding.hasBase ? '/' : '/map'} replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nameIssue = nameProblem(username)
    const passIssue = passwordProblem(password)
    if (nameIssue || passIssue || nameState === 'taken') {
      setError(nameIssue || passIssue || 'That name is already on the ledger.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await api<{ token: string; user: Profile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      if (!result.token) throw new ApiError('The API did not return a session.', 502)
      await login(result.token)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open a ledger.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Open a ledger">
      <p className="mt-2 text-sm text-muted">A crowbar is already in the trunk. Eight characters on the password.</p>
      <form className="mt-6 space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <label className="block text-sm">
          Name
          <span className="mt-1 flex items-center gap-2">
            <input
              className="w-full rounded-sm border border-line bg-ink px-3 py-2 outline-none focus:border-gold/40"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              maxLength={24}
              required
            />
            {nameState === 'free' ? (
              <span className="text-gold" aria-label="Name is free">
                ✓
              </span>
            ) : null}
          </span>
        </label>
        {nameProblem(username) ? <p className="text-sm text-danger">{nameProblem(username)}</p> : null}
        {nameState === 'taken' ? <p className="text-sm text-danger">That name is already on the ledger.</p> : null}
        <label className="block text-sm">
          Password
          <input
            className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 outline-none focus:border-gold/40"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {passwordProblem(password) ? <p className="text-sm text-danger">{passwordProblem(password)}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="gloss-gold w-full cursor-pointer rounded-full px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Writing the name…' : 'Create ledger'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already known? <Link className="text-gold" to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
