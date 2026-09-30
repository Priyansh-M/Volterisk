import { useEffect, useState } from 'react'
import { Btn, Notice } from '../components/ui.tsx'
import { ApiError, api, load } from '../lib/api.ts'
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

  async function reload() {
    const data = await load<Reputation>('/api/reputation')
    setFile(data)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'The standing did not load.'))
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
    <div className="flex flex-col gap-4">
      <section className={`border border-primary/40 bg-card px-4 py-3 ${shift ? 'rep-shift' : ''}`}>
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">From</p>
            <p className="rep-label font-display text-2xl font-semibold uppercase">Level {left}</p>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">{file ? (file.total === 0 ? 'Standing complete' : `${file.met} / ${file.total}`) : '—'}</p>
          <div className="text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{right ? 'To' : 'Cap'}</p>
            <p className="rep-label font-display text-2xl font-semibold uppercase text-primary">{right ? `Level ${right}` : 'Held'}</p>
          </div>
        </div>
        <div className="relative h-1.5 overflow-hidden bg-background">
          <div className="rep-bar-fill h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </section>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {note ? <Notice tone="ok">{note}</Notice> : null}
      {!file && !error ? <Notice tone="muted">Reading the ladder…</Notice> : null}

      {file ? (
        <section className="border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Current standing</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-3xl font-semibold uppercase">Level {String(file.level).padStart(2, '0')}</h2>
            {file.ready && file.reward != null ? (
              <Btn variant="gold" disabled={busy} onClick={() => void claim()}>
                {busy ? 'Claiming…' : `Claim ${money(file.reward)}`}
              </Btn>
            ) : null}
          </div>
          <h3 className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Conditions for next level</h3>
          {file.conditions.length === 0 ? (
            <p className="mt-4 text-lg text-muted-foreground">Level {file.maxLevel} is the top of the ladder.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border border border-border">
              {file.conditions.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[10px] ${
                      row.met ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {row.met ? '✓' : ''}
                  </span>
                  <span className={`text-sm leading-snug ${row.met ? 'text-foreground' : 'text-muted-foreground'}`}>{row.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <p className="pt-2 text-sm text-muted-foreground">
        This is the level on your file. The job application needs it. Everyone starts at level 1.
      </p>
    </div>
  )
}
