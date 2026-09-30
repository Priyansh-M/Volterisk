import { useState } from 'react'
import { useAuth } from '../lib/auth.tsx'
import { ApiError, api } from '../lib/api.ts'
import { money } from '../lib/format.ts'
import type { StarterClaim } from '../lib/types.ts'
import { OnboardingChart } from './MapPage.tsx'

export function OnboardingPage() {
  const { me } = useAuth()
  const [acked, setAcked] = useState(false)
  if (!me) return null
  if (!me.onboarding.hasClaimedStarter) {
    return acked ? <Allocation /> : <Initialized name={me.username} onAck={() => setAcked(true)} />
  }
  return (
    <div className="classified-grid min-h-screen p-4 md:p-6">
      <p className="mb-3 font-serif text-2xl tracking-[0.18em] text-paper md:text-3xl">SELECT YOUR BASE</p>
      <p className="mb-4 max-w-xl text-sm text-muted">Every grid square on Volterisk is a sector. Occupied squares already hold a base.</p>
      <OnboardingChart />
    </div>
  )
}

function Initialized({ name, onAck }: { name: string; onAck: () => void }) {
  return (
    <div className="classified-grid flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-lg border border-line bg-ink/80 p-8 text-center">
        <p className="mx-auto inline-block border border-gold px-3 py-1 text-[10px] tracking-[0.32em] text-gold">CLASSIFIED</p>
        <h1 className="mt-6 font-serif text-3xl tracking-[0.16em] text-paper md:text-4xl">OPERATION INITIALIZED</h1>
        <p className="mt-2 text-[11px] tracking-[0.22em] text-muted uppercase">Eyes only</p>
        <dl className="mx-auto mt-8 max-w-sm space-y-3 text-left text-sm">
          <Row label="Operator" value={name} />
          <Row label="Status" value="Awaiting asset allocation" />
          <Row label="Clearance" value="Field" />
        </dl>
        <button type="button" className="gloss-gold mt-8 cursor-pointer px-6 py-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase" onClick={onAck}>
          Acknowledge orders
        </button>
      </section>
    </div>
  )
}

function Allocation() {
  const { refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kit, setKit] = useState<StarterClaim | null>(null)

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      const claim = await api<StarterClaim>('/api/onboarding/claim', { method: 'POST', body: '{}' })
      setKit(claim)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The desk did not hand over the kit.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="classified-grid flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-lg border border-line bg-ink/80 p-8">
        <p className="text-[10px] tracking-[0.28em] text-gold uppercase">Classified // eyes only</p>
        <h1 className="mt-3 font-serif text-3xl tracking-[0.12em] text-paper">INITIAL ASSET ALLOCATION</h1>
        <dl className="mt-8 space-y-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <dt className="text-sm text-muted">Operating capital</dt>
            <dd className="font-display text-3xl text-primary">{kit ? money(kit.cash) : money(1_000)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <dt className="text-sm text-muted">Issued weapon</dt>
            <dd>Rusty Crowbar</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Starter kit</dt>
            <dd className="mt-1 text-sm text-paper">Rusty Crowbar, level 1. Nothing else is in the case.</dd>
          </div>
        </dl>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <button
          type="button"
          disabled={busy}
          className="gloss-gold mt-8 w-full cursor-pointer px-6 py-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase disabled:opacity-50"
          onClick={() => void accept()}
        >
          {busy ? 'Filing…' : 'Accept allocation'}
        </button>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/80 pb-2">
      <dt className="text-[11px] tracking-[0.16em] text-muted uppercase">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}
