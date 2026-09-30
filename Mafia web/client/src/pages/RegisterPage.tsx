import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import type { Profile } from '../lib/types.ts'
import { AuthLayout } from './AuthLayout.tsx'

export function RegisterPage() {
  const { me, loading, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState(false)
  const filed = useRef(false)

  if (!loading && me && !filed.current) return <Navigate to={me.onboarding.hasBase ? '/' : '/map'} replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await api<{ token: string; user: Profile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      filed.current = true
      await login(result.token)
      setWarn(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open a ledger.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Open a ledger">
      {warn ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4">
          <section className="animate-dossier w-full max-w-lg border border-primary bg-card p-6 shadow-2xl">
            <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">Before you step onto the chart</p>
            <h2 className="mt-2 font-display text-3xl font-semibold uppercase">Keep the cash in the vault</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Heat is the number at the top left of the bar. Heists push it up. Work and time bring it down.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              At 12:00 GMT, if Heat is still above 50, there is a 95% chance the police take every dollar still in your pocket. Money sitting in the vault is not part of that seizure.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The vault can still be robbed, but it has a door, a capacity, and insurance. Loose cash has none of those. Deposit before you go looking for trouble.
            </p>
            <button type="button" className="gloss-gold mt-5 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={() => navigate('/map')}>
              I understand
            </button>
          </section>
        </div>
      ) : null}
      <p className="mt-2 text-sm text-muted">A crowbar is already in the trunk. Eight characters on the password.</p>
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
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
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
