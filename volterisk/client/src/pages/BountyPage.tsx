import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Portrait } from '../components/Portrait.tsx'
import { Btn, Notice, inputClass } from '../components/ui.tsx'
import { ApiError, api, load } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

type BountyCard = {
  id: string
  amount: number
  funded: number
  goal: number
  stolenTotal: number
  progress: number
  status: string
  expiresAt: string | null
  poster: { id: string; username: string; avatarUrl: string | null }
  target: { id: string; username: string; avatarUrl: string | null; vaultEligible: boolean }
  youArePoster: boolean
  youAreTarget: boolean
  youStarted: boolean
  yourStolen: number
  canStart: boolean
  canHeist: boolean
  canFund: boolean
  canCancel: boolean
  heistPath: string
}

type Board = {
  bounties: BountyCard[]
  rules: { minAmount: number; minTargetVault: number; durationsHours?: number[] }
}

const DURATION_OPTIONS = [
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '48 hours' },
  { hours: 72, label: '72 hours' },
  { hours: 168, label: '1 week' },
] as const

function endsLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const ms = Date.parse(expiresAt) - Date.now()
  if (ms <= 0) return 'Ending…'
  const hours = Math.ceil(ms / 3_600_000)
  if (hours >= 48) return `Ends in ${Math.ceil(hours / 24)}d`
  return `Ends in ${hours}h`
}

type Hit = { id: string; username: string; avatarUrl: string | null; vaultBalance: number }

export function BountyPage() {
  const { me, applyCash } = useAuth()
  const navigate = useNavigate()
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [fundingId, setFundingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [picked, setPicked] = useState<Hit | null>(null)
  const [amount, setAmount] = useState('5000')
  const [durationHours, setDurationHours] = useState(24)
  const [fundAmount, setFundAmount] = useState('5000')

  async function reload() {
    const data = await load<Board>('/api/bounties')
    setBoard(data)
    return data
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the board.'))
  }, [])

  useEffect(() => {
    if (!adding || query.trim().length < 1) {
      setHits([])
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      api<{ players: Hit[] }>(`/api/bounties/search?q=${encodeURIComponent(query.trim())}`)
        .then((data) => {
          if (!cancelled) setHits(data.players)
        })
        .catch(() => {
          if (!cancelled) setHits([])
        })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [adding, query])

  async function postBounty() {
    if (!picked) return
    setBusy('post')
    setError(null)
    try {
      const paid = await api<{ cash: number }>('/api/bounties', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: picked.id, amount: Number(amount), durationHours }),
      })
      applyCash(paid.cash)
      setAdding(false)
      setPicked(null)
      setQuery('')
      setAmount('5000')
      setDurationHours(24)
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The board refused the contract.')
    } finally {
      setBusy(null)
    }
  }

  async function start(id: string) {
    setBusy(id)
    setError(null)
    try {
      const data = await api<{ heistPath: string }>(`/api/bounties/${id}/start`, {
        method: 'POST',
        body: '{}',
      })
      await reload()
      navigate(data.heistPath)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start that contract.')
    } finally {
      setBusy(null)
    }
  }

  async function fund(id: string) {
    setBusy(id)
    setError(null)
    try {
      const paid = await api<{ cash: number }>(`/api/bounties/${id}/fund`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(fundAmount) }),
      })
      applyCash(paid.cash)
      setFundingId(null)
      setFundAmount('5000')
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add to that pool.')
    } finally {
      setBusy(null)
    }
  }

  async function cancel(id: string) {
    setBusy(id)
    setError(null)
    try {
      const paid = await api<{ cash: number }>(`/api/bounties/${id}/cancel`, { method: 'POST', body: '{}' })
      applyCash(paid.cash)
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel that contract.')
    } finally {
      setBusy(null)
    }
  }

  const rules = board?.rules
  const min = rules?.minAmount ?? 5000
  const preview = Math.max(0, Math.trunc(Number(amount) || 0))

  return (
    <div>
      <div className="mb-4 max-w-xl border border-border bg-card p-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">How it works</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The cash you post is both the <span className="text-foreground">reward pool</span> and the{' '}
          <span className="text-foreground">steal goal</span>. Pick a time limit (24h–1 week). Press{' '}
          <span className="text-foreground">Start</span> before heists count. Payout when the goal fills, the timer ends,
          or cancel — contributors get their share; remaining cash returns to funders.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold uppercase tracking-wide">Bounties</h1>
        <Btn variant="gold" onClick={() => setAdding(true)}>
          Add new +
        </Btn>
      </div>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!board && !error ? <Notice tone="muted">Loading the board…</Notice> : null}

      <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {(board?.bounties ?? []).map((row) => (
          <Poster
            key={row.id}
            row={row}
            busy={busy}
            funding={fundingId === row.id}
            fundAmount={fundAmount}
            min={min}
            cash={me?.cash ?? 0}
            onFundAmount={setFundAmount}
            onStart={() => void start(row.id)}
            onHeist={() => navigate(row.heistPath)}
            onFundOpen={() => {
              setFundingId(row.id)
              setFundAmount('5000')
            }}
            onFundClose={() => setFundingId(null)}
            onFundConfirm={() => void fund(row.id)}
            onCancel={() => void cancel(row.id)}
          />
        ))}
      </div>
      {board && board.bounties.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No open contracts. Post one if you have the cash.</p>
      ) : null}

      {adding ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <section className="w-full max-w-md border border-border bg-card p-5">
            <p className="font-mono text-[9px] uppercase text-muted-foreground">New contract</p>
            <h2 className="mt-1 font-display text-2xl font-semibold uppercase">Add bounty</h2>
            <label className="mt-4 block font-mono text-[10px] uppercase text-muted-foreground">
              Mark
              <input
                className={`${inputClass} mt-2`}
                value={picked ? picked.username : query}
                onChange={(event) => {
                  setPicked(null)
                  setQuery(event.target.value)
                }}
                placeholder="Search player…"
              />
            </label>
            {!picked && hits.length > 0 ? (
              <ul className="mt-2 max-h-40 overflow-y-auto border border-border">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setPicked(hit)
                        setQuery(hit.username)
                        setHits([])
                      }}
                    >
                      <Portrait name={hit.username} url={hit.avatarUrl} className="h-8 w-8 border border-border" />
                      <span className="flex-1">{hit.username}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{money(hit.vaultBalance)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label className="mt-4 block font-mono text-[10px] uppercase text-muted-foreground">
              Bounty amount (reward and steal goal)
              <input
                className={`${inputClass} mt-2`}
                type="number"
                min={min}
                step={1000}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="mt-4 block font-mono text-[10px] uppercase text-muted-foreground">
              Time limit
              <select
                className={`${inputClass} mt-2`}
                value={durationHours}
                onChange={(event) => setDurationHours(Number(event.target.value))}
              >
                {DURATION_OPTIONS.map((option) => (
                  <option key={option.hours} value={option.hours}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              Minimum {money(min)}. Taken from your cash ({money(me?.cash ?? 0)}).
            </p>
            {preview >= min ? (
              <p className="mt-2 border border-border bg-ink/40 px-3 py-2 text-xs text-foreground">
                This posts a <span className="text-gold">{money(preview)}</span> bounty — hunters must steal{' '}
                <span className="text-gold">{money(preview)}</span> from the mark to fill it within{' '}
                {DURATION_OPTIONS.find((row) => row.hours === durationHours)?.label ?? '24 hours'}. Payout when the goal
                is met, cancelled, or the timer ends.
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Btn
                variant="gold"
                disabled={busy !== null || !picked || Number(amount) < min || (me !== null && me.cash < Number(amount))}
                onClick={() => void postBounty()}
              >
                {busy === 'post' ? 'Posting…' : 'Post bounty'}
              </Btn>
              <Btn
                disabled={busy !== null}
                onClick={() => {
                  setAdding(false)
                  setPicked(null)
                  setQuery('')
                }}
              >
                Cancel
              </Btn>
              {me !== null && Number(amount) > 0 && me.cash < Number(amount) ? (
                <span className="text-xs text-destructive">Not enough cash</span>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function Poster({
  row,
  busy,
  funding,
  fundAmount,
  min,
  cash,
  onFundAmount,
  onStart,
  onHeist,
  onFundOpen,
  onFundClose,
  onFundConfirm,
  onCancel,
}: {
  row: BountyCard
  busy: string | null
  funding: boolean
  fundAmount: string
  min: number
  cash: number
  onFundAmount: (value: string) => void
  onStart: () => void
  onHeist: () => void
  onFundOpen: () => void
  onFundClose: () => void
  onFundConfirm: () => void
  onCancel: () => void
}) {
  const statusLabel =
    row.status === 'hunting'
      ? 'Hunt live'
      : row.youStarted
        ? 'You started'
        : 'Awaiting start'
  const timer = endsLabel(row.expiresAt)

  return (
    <article
      className="relative overflow-hidden border border-border shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-gold)_12%,transparent)]"
      style={{
        background:
          'linear-gradient(165deg, oklch(0.19 0.018 72) 0%, oklch(0.155 0.014 70) 45%, oklch(0.135 0.012 68) 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0.45 0.04 75) 2px, oklch(0.45 0.04 75) 3px), repeating-linear-gradient(90deg, transparent, transparent 2px, oklch(0.45 0.04 75) 2px, oklch(0.45 0.04 75) 3px)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="relative m-3 border border-gold/30 bg-ink/35 px-4 pb-4 pt-5">
        <p className="text-center font-display text-4xl font-semibold tracking-[0.12em] text-gold uppercase">Wanted</p>
        <p className="mt-1 text-center font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          By {row.poster.username}
        </p>
        <div className="mx-auto mt-4 aspect-[5/4] w-full max-w-[220px] overflow-hidden border border-gold/25 bg-board">
          <Portrait name={row.target.username} url={row.target.avatarUrl} className="h-full w-full text-3xl text-gold" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-gold/40" />
          <p className="font-display text-sm tracking-[0.18em] text-gold uppercase">Open contract</p>
          <span className="h-px w-8 bg-gold/40" />
        </div>
        <h2 className="mt-2 text-center font-display text-3xl font-semibold uppercase tracking-wide text-paper">
          {row.target.username}
        </h2>
        <p className="mt-3 text-center font-display text-3xl font-semibold text-gold">{money(row.amount)}</p>
        <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Steal goal {money(row.goal)} · pool {money(row.amount)}
        </p>
        <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {statusLabel} · {row.progress}% · stolen {money(row.stolenTotal)}
          {row.youStarted ? ` · your cut ${money(row.yourStolen)}` : ''}
          {timer ? ` · ${timer}` : ''}
          {!row.target.vaultEligible ? ' · vault thin' : ''}
        </p>
        {funding ? (
          <div className="mt-4 space-y-2">
            <input
              className={inputClass}
              type="number"
              min={min}
              step={1000}
              value={fundAmount}
              onChange={(event) => onFundAmount(event.target.value)}
            />
            <p className="text-center text-[10px] text-muted-foreground">
              Adds to both the steal goal and the reward pool.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Btn
                variant="gold"
                disabled={busy !== null || Number(fundAmount) < min || cash < Number(fundAmount)}
                onClick={onFundConfirm}
              >
                {busy === row.id ? 'Adding…' : 'Confirm'}
              </Btn>
              <Btn disabled={busy !== null} onClick={onFundClose}>
                Back
              </Btn>
              {cash < Number(fundAmount) ? <span className="text-xs text-destructive">Not enough cash</span> : null}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {row.canStart ? (
              <Btn variant="gold" disabled={busy !== null} onClick={onStart}>
                {busy === row.id ? 'Starting…' : 'Start bounty'}
              </Btn>
            ) : null}
            {row.canHeist ? (
              <Btn variant="gold" disabled={busy !== null} onClick={onHeist}>
                Heist mark
              </Btn>
            ) : null}
            {row.canFund ? (
              <Btn disabled={busy !== null} onClick={onFundOpen}>
                Add cash
              </Btn>
            ) : null}
            {row.canCancel ? (
              <Btn variant="danger" disabled={busy !== null} onClick={onCancel}>
                Cancel
              </Btn>
            ) : null}
          </div>
        )}
      </div>
      <div className="h-px w-full bg-border/60" aria-hidden="true">
        <div className="h-px bg-gold" style={{ width: `${Math.min(100, Math.max(0, row.progress))}%` }} />
      </div>
    </article>
  )
}
