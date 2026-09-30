import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { money } from '../lib/format.ts'
import type { GameNotice } from '../lib/types.ts'

type Unlock = { id: string; name: string; description: string; reward: number }
type HeistNotice = { id: string; by: string; success: boolean; amountStolen: number | null }

export function LedgerAlerts({
  onChange,
  onUnclaimed,
}: {
  onChange: (unread?: number) => void
  onUnclaimed?: (count: number) => void
}) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [unlock, setUnlock] = useState<Unlock | null>(null)
  const [heist, setHeist] = useState<HeistNotice | null>(null)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const [alerts, notes] = await Promise.all([
          api<{ unlocked: Unlock[]; unclaimed?: number }>('/api/achievements/unannounced'),
          api<{ notifications: GameNotice[] }>('/api/notifications'),
        ])
        if (cancelled) return
        onChangeRef.current(notes.notifications.filter((row) => row.read !== true).length)
        if (typeof alerts.unclaimed === 'number') onUnclaimed?.(alerts.unclaimed)
        const next = alerts.unlocked[0]
        const report = notes.notifications.find(
          (row) => row.read !== true && (row.title === 'Heist Attempted' || row.title === 'You were robbed'),
        )
        const robbed = report?.title === 'You were robbed'
        if (next && !robbed) setUnlock(next)
        if (report && (!next || robbed)) {
          let parsed: { by?: string; success?: boolean; amountStolen?: number | null } = {}
          try {
            parsed = JSON.parse(report.body) as typeof parsed
          } catch {
            parsed = { by: report.body, success: false, amountStolen: null }
          }
          setHeist({
            id: report.id,
            by: parsed.by ?? 'Unknown',
            success: Boolean(parsed.success),
            amountStolen: parsed.amountStolen ?? null,
          })
        }
      } catch {
        /* the desk will try again */
      }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 30000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  function ackUnlock(id: string) {
    void api('/api/achievements/ack', { method: 'POST', body: JSON.stringify({ id }) }).catch(() => undefined)
  }

  async function dismissHeist() {
    if (!heist) return
    const id = heist.id
    setHeist(null)
    await api(`/api/notifications/${id}/read`, { method: 'POST', body: '{}' }).catch(() => undefined)
    onChange()
  }

  if (!unlock && !heist) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/75 p-4">
      {unlock ? (
        <section className="animate-dossier relative w-full max-w-md border border-primary bg-card p-8 text-center shadow-2xl">
          <button
            type="button"
            aria-label="Close"
            className="absolute top-3 right-3 cursor-pointer px-1 font-mono text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              ackUnlock(unlock.id)
              setUnlock(null)
            }}
          >
            ×
          </button>
          <p className="font-mono text-[10px] uppercase text-primary">Record unsealed</p>
          <h2 className="mt-3 font-display text-4xl font-semibold uppercase">Congrats on {unlock.name}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{unlock.description}</p>
          <p className="mt-4 font-mono text-xs text-primary">Claim {money(unlock.reward)} on the record</p>
          <Link
            to="/achievements"
            className="gloss-gold mt-6 block w-full cursor-pointer px-4 py-2 text-center text-[11px] font-semibold tracking-[0.16em] uppercase no-underline"
            onClick={() => {
              ackUnlock(unlock.id)
              setUnlock(null)
            }}
          >
            Open achievements
          </Link>
        </section>
      ) : heist ? (
        <section className="animate-dossier w-full max-w-md border border-border bg-card p-8 shadow-2xl">
          <p className="font-mono text-[10px] uppercase text-destructive">Incoming report</p>
          <h2 className="mt-2 font-display text-4xl font-semibold uppercase">{heist.success ? 'You were robbed' : 'Heist Attempted'}</h2>
          <p className="mt-4 text-sm text-muted-foreground">By</p>
          <p className="font-display text-2xl font-semibold uppercase">{heist.by}</p>
          {heist.success ? (
            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="font-mono text-[10px] uppercase text-muted-foreground">Money Stolen</dt>
                <dd className="font-mono">{money(heist.amountStolen ?? 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-mono text-[10px] uppercase text-muted-foreground">Attacker</dt>
                <dd>{heist.by}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">The door held. Nothing left the vault.</p>
          )}
          <button type="button" className="nav-pill mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={() => void dismissHeist()}>
            File the report
          </button>
        </section>
      ) : null}
    </div>
  )
}
