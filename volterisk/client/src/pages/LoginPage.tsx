import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import type { Profile } from '../lib/types.ts'
import { AuthLayout } from './AuthLayout.tsx'

export function LoginPage() {
  const { me, loading, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && me?.onboarding) return <Navigate to={me.onboarding.hasBase ? '/' : '/map'} replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await api<{ token: string; user: Profile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      if (!result.token || !result.user?.onboarding) throw new ApiError('The API did not return a session.', 502)
      await login(result.token)
      navigate(result.user.onboarding.hasBase ? '/' : '/map')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Sign in">
      <form className="mt-6 space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <label className="block text-sm">
          Name
          <input
            className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 outline-none focus:border-gold/40"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 outline-none focus:border-gold/40"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="gloss-gold w-full cursor-pointer rounded-full px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Checking the book…' : 'Enter'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        New name? <Link className="text-gold" to="/register">Open a ledger</Link>
      </p>
    </AuthLayout>
  )
}
