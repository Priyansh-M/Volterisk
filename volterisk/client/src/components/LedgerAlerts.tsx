import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { money } from '../lib/format.ts'
import type { GameNotice } from '../lib/types.ts'

type Unlock = { id: string; name: string; description: string; reward: number }
type HeistNotice = { id: string; by: string; success: boolean; amountStolen: number | null }
type HeatNotice = { id: string; title: string; body: string }

export function LedgerAlerts({
  onChange,
  onUnclaimed,
  paused = false,
}: {
  onChange: (unread?: number) => void
  onUnclaimed?: (count: number) => void
  paused?: boolean
}) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [unlock, setUnlock] = useState<Unlock | null>(null)
  const [heist, setHeist] = useState<HeistNotice | null>(null)
  const [heatNote, setHeatNote] = useState<HeatNotice | null>(null)
  const [invite, setInvite] = useState<{ id: string; by: string; lobbyId: string } | null>(null)
  const [tableEnded, setTableEnded] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    let busy = false
    async function poll() {
      if (cancelled || busy) return
      busy = true
      try {
        const [alerts, notes] = await Promise.all([
          api<{ unlocked: Unlock[]; unclaimed?: number }>('/api/achievements/unannounced'),
          api<{ notifications: GameNotice[] }>('/api/notifications'),
        ])
        if (cancelled) return
        onChangeRef.current(notes.notifications.filter((row) => row.read !== true).length)
        if (typeof alerts.unclaimed === 'number') onUnclaimed?.(alerts.unclaimed)
        const endedNote = notes.notifications.find((row) => row.read !== true && row.title === 'Game ended')
        if (endedNote) setTableEnded(endedNote.id)
        const tableInvite = notes.notifications.find((row) => row.read !== true && row.title === 'Roulette invite')
        if (tableInvite) {
          let parsed: { by?: string; lobbyId?: string } = {}
          try {
            parsed = JSON.parse(tableInvite.body) as typeof parsed
          } catch {
            parsed = {}
          }
          const here = new URLSearchParams(window.location.search).get('lobby')
          if (parsed.lobbyId && parsed.lobbyId !== here) {
            setInvite({ id: tableInvite.id, by: parsed.by ?? 'A player', lobbyId: parsed.lobbyId })
            void import('../pages/RoulettePage.tsx')
          } else if (parsed.lobbyId && parsed.lobbyId === here) {
            void api(`/api/notifications/${tableInvite.id}/read`, { method: 'POST', body: '{}' }).catch(() => undefined)
          }
        }
        const next = alerts.unlocked[0]
        const report = notes.notifications.find(
          (row) => row.read !== true && (row.title === 'Heist Attempted' || row.title === 'You were robbed'),
        )
        const heatReport = notes.notifications.find(
          (row) => row.read !== true && (row.title === 'Cash seized' || row.title === 'Heat check'),
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
        } else if (heatReport && !next) {
          setHeatNote({ id: heatReport.id, title: heatReport.title, body: heatReport.body })
        }
      } catch {
        /* the desk will try again */
      } finally {
        busy = false
      }
    }
    if (paused) return
    const start = window.setTimeout(() => void poll(), 400)
    const timer = window.setInterval(() => void poll(), 8000)
    return () => {
      cancelled = true
      window.clearTimeout(start)
      window.clearInterval(timer)
    }
  }, [paused])

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

  async function dismissHeat() {
    if (!heatNote) return
    setHeatNote(null)
    try {
      const notes = await api<{ notifications: GameNotice[] }>('/api/notifications')
      const heatIds = notes.notifications
        .filter((row) => row.read !== true && (row.title === 'Cash seized' || row.title === 'Heat check'))
        .map((row) => row.id)
      await Promise.all(
        heatIds.map((id) => api(`/api/notifications/${id}/read`, { method: 'POST', body: '{}' }).catch(() => undefined)),
      )
    } catch {
      await api(`/api/notifications/${heatNote.id}/read`, { method: 'POST', body: '{}' }).catch(() => undefined)
    }
    onChange()
  }

  if (!unlock && !heist && !heatNote && !invite && !tableEnded) return null

  const revealHeist = Boolean(heist) && !tableEnded && !invite && !unlock && !heatNote

  return (
    <div className={`${revealHeist ? 'heist-reveal' : 'fixed inset-0'} z-[80] flex items-center justify-center bg-background/75 p-4`}>
      {revealHeist ? <span className="heist-reveal-line" aria-hidden="true" /> : null}
      {tableEnded ? (
        <section className="animate-dossier w-full max-w-md border border-border bg-card p-8 text-center shadow-2xl">
          <h2 className="font-display text-4xl font-semibold uppercase">Game has ended</h2>
          <button
            type="button"
            className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
            onClick={() => {
              const id = tableEnded
              setTableEnded(null)
              void api(`/api/notifications/${id}/read`, { method: 'POST', body: '{}' })
            }}
          >
            Close
          </button>
        </section>
      ) : invite ? (
        <section className="animate-dossier w-full max-w-md border border-primary bg-card p-8 text-center shadow-2xl">
          <p className="font-mono text-[10px] uppercase text-primary">Table</p>
          <h2 className="mt-3 font-display text-3xl font-semibold uppercase">You have been invited to a round of roulette</h2>
          <p className="mt-4 text-sm text-muted-foreground">From {invite.by}.</p>
          <button
            type="button"
            className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
            onClick={() => {
              const next = invite
              setInvite(null)
              void import('../pages/RoulettePage.tsx')
              void Promise.all([
                api(`/api/notifications/${next.id}/read`, { method: 'POST', body: '{}' }),
                api(`/api/casino/lobby/${next.lobbyId}/join`, { method: 'POST', body: '{}' }),
              ]).finally(() => navigate(`/casino/roulette?lobby=${encodeURIComponent(next.lobbyId)}`))
            }}
          >
            Sit down
          </button>
          <button
            type="button"
            className="nav-pill mt-2 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
            onClick={() => {
              const id = invite.id
              setInvite(null)
              void api(`/api/notifications/${id}/read`, { method: 'POST', body: '{}' })
            }}
          >
            Not now
          </button>
        </section>
      ) : unlock ? (
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
      ) : heatNote ? (
        <section className="animate-dossier relative w-full max-w-md border border-destructive bg-card p-8 shadow-2xl">
          <button
            type="button"
            aria-label="Close"
            className="absolute top-3 right-3 cursor-pointer px-1 font-mono text-sm text-muted-foreground hover:text-foreground"
            onClick={() => void dismissHeat()}
          >
            ×
          </button>
          <p className="font-mono text-[10px] tracking-[0.2em] text-destructive uppercase">Heat check</p>
          <h2 className="mt-3 font-display text-3xl font-semibold uppercase">{heatNote.title}</h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{heatNote.body}</p>
          <button
            type="button"
            className="nav-pill mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
            onClick={() => void dismissHeat()}
          >
            Continue
          </button>
        </section>
      ) : heist ? (
        <section className="heist-reveal-card relative z-[1] w-full max-w-md border border-border bg-card p-8 shadow-2xl">
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
            Continue
          </button>
        </section>
      ) : null}
    </div>
  )
}
