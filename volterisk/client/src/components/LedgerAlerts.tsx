import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { bumpDesk, subscribeDesk } from '../lib/deskPoll.ts'
import { money } from '../lib/format.ts'
import { NEXT_STAGE_READY_KEY } from './Level11Guide.tsx'

function nextStageReady(): boolean {
  const at = Number(localStorage.getItem(NEXT_STAGE_READY_KEY) ?? 0)
  return at > 0 && Date.now() >= at
}

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
  const onUnclaimedRef = useRef(onUnclaimed)
  onUnclaimedRef.current = onUnclaimed
  const { me } = useAuth()
  const lateRef = useRef(false)
  lateRef.current = (me?.level ?? 0) >= 11 || Boolean(me?.vaultCreditCard)
  const [unlocks, setUnlocks] = useState<Unlock[]>([])
  const [heists, setHeists] = useState<HeistNotice[]>([])
  const [heats, setHeats] = useState<HeatNotice[]>([])
  const [deskAt, setDeskAt] = useState(0)
  const [invite, setInvite] = useState<{ id: string; by: string; lobbyId: string } | null>(null)
  const [tableEnded, setTableEnded] = useState<string | null>(null)
  const navigate = useNavigate()
  const shown = useRef(new Set<string>())

  useEffect(() => {
    if (paused) return
    function onNextStageReady() {
      bumpDesk()
    }
    window.addEventListener('volterisk-next-stage-ready', onNextStageReady)
    return () => window.removeEventListener('volterisk-next-stage-ready', onNextStageReady)
  }, [paused])

  useEffect(() => {
    if (paused) return
    return subscribeDesk((snap) => {
      onChangeRef.current(snap.notifications.filter((row) => row.read !== true).length)
      if (typeof snap.unclaimed === 'number') onUnclaimedRef.current?.(snap.unclaimed)
      const endedNote = snap.notifications.find((row) => row.read !== true && row.title === 'Game ended')
      if (endedNote) setTableEnded(endedNote.id)
      const tableInvite = snap.notifications.find((row) => row.read !== true && row.title === 'Roulette invite')
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
      // Next stage waits until territory is set up, then 5s (see Level11Guide).
      const unlocked = snap.unlocked.filter((row) => row.id !== 'next-stage' || nextStageReady())
      const heistIncoming = snap.notifications
        .filter((row) => row.read !== true && (row.title === 'Heist Attempted' || row.title === 'You were robbed'))
        .map((report) => {
          let parsed: { by?: string; success?: boolean; amountStolen?: number | null } = {}
          try {
            parsed = JSON.parse(report.body) as typeof parsed
          } catch {
            parsed = { by: report.body, success: false, amountStolen: null }
          }
          return {
            id: report.id,
            by: parsed.by ?? 'Unknown',
            success: Boolean(parsed.success),
            amountStolen: parsed.amountStolen ?? null,
          }
        })
      const heatIncoming = snap.notifications
        .filter((row) => row.read !== true && (
          row.title === 'Police bounty' ||
          row.title === 'Police confiscation' ||
          (!lateRef.current && (row.title === 'Cash seized' || row.title === 'Heat check'))
        ))
        .map((row) => ({ id: row.id, title: row.title, body: row.body }))
      const addUnlocks = unlocked.filter((row) => !shown.current.has(`u:${row.id}`))
      const addHeists = heistIncoming.filter((row) => !shown.current.has(`r:${row.id}`))
      const addHeats = heatIncoming.filter((row) => !shown.current.has(`h:${row.id}`))
      for (const row of addUnlocks) {
        shown.current.add(`u:${row.id}`)
        void api('/api/achievements/ack', { method: 'POST', body: JSON.stringify({ id: row.id }) }).catch(() => undefined)
      }
      const noteIds = [...addHeists.map((row) => row.id), ...addHeats.map((row) => row.id)]
      for (const row of addHeists) shown.current.add(`r:${row.id}`)
      for (const row of addHeats) shown.current.add(`h:${row.id}`)
      if (addHeats.length > 0) setDeskAt(0)
      if (noteIds.length > 0) {
        void api('/api/notifications/read', { method: 'POST', body: JSON.stringify({ ids: noteIds }) }).catch(() => undefined)
      }
      setUnlocks((prev) => {
        const kept = prev.filter((row) => shown.current.has(`u:${row.id}`))
        const add = addUnlocks.filter((row) => !kept.some((row2) => row2.id === row.id))
        return [...kept, ...add]
      })
      setHeists((prev) => {
        const kept = prev.filter((row) => shown.current.has(`r:${row.id}`))
        const add = addHeists.filter((row) => !kept.some((row2) => row2.id === row.id))
        return [...kept, ...add]
      })
      setHeats((prev) => {
        const kept = prev.filter((row) => shown.current.has(`h:${row.id}`))
        const add = addHeats.filter((row) => !kept.some((row2) => row2.id === row.id))
        return [...add, ...kept]
      })
    })
  }, [paused])

  async function dismissDesk() {
    const noteIds = [...heists.map((row) => row.id), ...heats.map((row) => row.id)]
    const achievementIds = unlocks.map((row) => row.id)
    setHeists([])
    setHeats([])
    setUnlocks([])
    setDeskAt(0)
    await Promise.all([
      noteIds.length > 0
        ? api('/api/notifications/read', { method: 'POST', body: JSON.stringify({ ids: noteIds }) }).catch(() => undefined)
        : Promise.resolve(),
      ...achievementIds.map((id) => api('/api/achievements/ack', { method: 'POST', body: JSON.stringify({ id }) }).catch(() => undefined)),
    ])
    bumpDesk()
  }

  const deskSlides: Array<{ key: string; node: ReactNode }> = [
    ...heats.map((heatNote) => ({
      key: `h:${heatNote.id}`,
      node: (
        <>
          <p className="font-mono text-[10px] tracking-[0.2em] text-destructive uppercase">
            {heatNote.title === 'Police bounty' || heatNote.title === 'Police confiscation' ? 'Police' : 'Heat check'}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold uppercase">
            {heatNote.title === 'Police bounty' || heatNote.title === 'Police confiscation' ? heatNote.body : heatNote.title}
          </h2>
          {heatNote.title === 'Police bounty' || heatNote.title === 'Police confiscation' ? null : (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{heatNote.body}</p>
          )}
        </>
      ),
    })),
    ...heists.map((heist) => ({
      key: `r:${heist.id}`,
      node: (
        <>
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
        </>
      ),
    })),
    ...unlocks.map((unlock) => ({
      key: `u:${unlock.id}`,
      node: (
        <>
          <p className="font-mono text-[10px] uppercase text-primary">Record unsealed</p>
          <h2 className="mt-3 font-display text-4xl font-semibold uppercase">Congrats on {unlock.name}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{unlock.description}</p>
          <p className="mt-4 font-mono text-xs text-primary">Claim {money(unlock.reward)} on the record</p>
          <Link
            to="/achievements"
            className="nav-pill mt-6 block w-full cursor-pointer px-4 py-2 text-center text-[11px] font-semibold tracking-[0.16em] uppercase no-underline"
            onClick={() => void dismissDesk()}
          >
            Open achievements
          </Link>
        </>
      ),
    })),
  ]
  const deskIndex = Math.min(deskAt, Math.max(0, deskSlides.length - 1))

  if (deskSlides.length === 0 && !invite && !tableEnded) return null

  const revealHeist = deskSlides[deskIndex]?.key.startsWith('r:') && !tableEnded && !invite

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
      ) : deskSlides[deskIndex] ? (
        <section className={`${revealHeist ? 'heist-reveal-card relative z-[1]' : 'animate-dossier'} relative w-full max-w-md border border-border bg-card px-12 py-8 text-center shadow-2xl`}>
          {deskSlides.length > 1 ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {deskIndex + 1} of {deskSlides.length}
            </p>
          ) : null}
          {deskSlides[deskIndex].node}
          {deskSlides.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous report"
                className="absolute top-1/2 left-2 flex h-[26px] w-[26px] -translate-y-1/2 cursor-pointer items-center justify-center bg-primary font-mono text-base leading-none text-black disabled:opacity-30"
                disabled={deskIndex === 0}
                onClick={() => setDeskAt((i) => Math.max(0, i - 1))}
              >
                {'<'}
              </button>
              <button
                type="button"
                aria-label="Next report"
                className="absolute top-1/2 right-2 flex h-[26px] w-[26px] -translate-y-1/2 cursor-pointer items-center justify-center bg-primary font-mono text-base leading-none text-black disabled:opacity-30"
                disabled={deskIndex >= deskSlides.length - 1}
                onClick={() => setDeskAt((i) => Math.min(deskSlides.length - 1, i + 1))}
              >
                {'>'}
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="nav-pill mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
            onClick={() => void dismissDesk()}
          >
            Dismiss
          </button>
        </section>
      ) : null}
    </div>
  )
}
