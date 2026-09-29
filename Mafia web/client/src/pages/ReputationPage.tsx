import { useEffect, useState } from 'react'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

type Reputation = {
  level: number
  maxLevel: number
  nextLevel: number | null
  reward: number | null
  ready: boolean
  met: number
  total: number
  cash: number
  conditions: { id: string; label: string; met: boolean }[]
}

export function ReputationPage() {
  const { refresh, applyCash } = useAuth()
  const [file, setFile] = useState<Reputation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shift, setShift] = useState(false)

  async function load() {
    const data = await api<Reputation>('/api/reputation')
    setFile(data)
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'The standing did not load.'))
  }, [])

  async function claim() {
    if (!file?.ready) return
    setBusy(true)
    setError(null)
    try {
      const paid = await api<Reputation>('/api/reputation/claim', { method: 'POST', body: '{}' })
      applyCash(paid.cash)
      setShift(true)
      setFile(paid)
      setNote(`Level ${paid.level} is on your file.`)
      void refresh()
      window.setTimeout(() => setShift(false), 700)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The claim did not go through.')
    } finally {
      setBusy(false)
    }
  }

  const left = file?.level ?? 1
  const right = file?.nextLevel
  const progress = !file ? 0 : file.total === 0 ? 100 : Math.round((file.met / file.total) * 100)

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <PageTitle kicker="Standing">Reputation</PageTitle>
      <p className="max-w-2xl text-sm text-muted-foreground">
        This is the level on your file. Work reads it. The number beside your name reads it. Everyone starts at level 1.
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {note ? <Notice tone="ok">{note}</Notice> : null}
      {!file && !error ? <Notice tone="muted">Reading the ladder…</Notice> : null}
      {file ? (
        <section className="mt-4 border border-border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Current standing</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-5xl font-semibold uppercase">Level {String(file.level).padStart(2, '0')}</h2>
            {file.ready && file.reward != null ? (
              <Btn variant="gold" disabled={busy} onClick={() => void claim()}>
                {busy ? 'Claiming…' : `Claim ${money(file.reward)}`}
              </Btn>
            ) : null}
          </div>
          <h3 className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Conditions for next level</h3>
          {file.conditions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Level {file.maxLevel} is the top of the ladder.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border border border-border">
              {file.conditions.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-3 py-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center border font-mono text-[10px] ${
                      row.met ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {row.met ? '✓' : ''}
                  </span>
                  <span className={`text-sm uppercase tracking-wide ${row.met ? 'text-foreground' : 'text-muted-foreground'}`}>{row.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <div className={`mt-auto pt-8 ${shift ? 'rep-shift' : ''}`}>
        <section className="border border-primary/40 bg-card p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.4)] sm:p-6">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">From</p>
              <p className="rep-label font-display text-3xl font-semibold uppercase sm:text-4xl">Level {left}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{right ? 'To' : 'Cap'}</p>
              <p className="rep-label font-display text-3xl font-semibold uppercase text-primary sm:text-4xl">
                {right ? `Level ${right}` : 'Held'}
              </p>
            </div>
          </div>
          <div className="relative h-8 overflow-hidden border border-border bg-background sm:h-10">
            <div className="rep-bar-fill h-full bg-primary" style={{ width: `${progress}%` }} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.16em] text-foreground mix-blend-difference">
              {file ? (file.total === 0 ? 'Standing complete' : `${file.met} / ${file.total}`) : '—'}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
