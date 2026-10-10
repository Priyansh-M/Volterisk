import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'
import { subscribeDesk } from '../lib/deskPoll.ts'
import type { GameNotice } from '../lib/types.ts'

/** Daily 12:00 GMT + territory popups — shown at noon settle or whenever the player logs in. */
const TOAST_TITLES = new Set([
  'Territory expansion unlocked',
  'How to expand territory',
  'Territory scouted',
  'Expansion scout started',
  'Territory claimed',
  'Territory secured',
  'Industrial locked in',
  'Financial locked in',
  'Expansion abandoned',
  'Diamond vault return',
  'Chop shop delivery',
  'Garage delivery',
  'Warehouse delivery',
  'Manufacturing plant delivery',
  'Passive payday',
  'Heat cleared',
])

const NOON_TITLES = new Set([
  'Diamond vault return',
  'Chop shop delivery',
  'Garage delivery',
  'Warehouse delivery',
  'Manufacturing plant delivery',
  'Passive payday',
  'Heat cleared',
])

type Card = { id: string; title: string; body: string }

function firstAccountPacing() {
  return (
    sessionStorage.getItem('volterisk-first-toasts') === '1' ||
    sessionStorage.getItem('volterisk-welcome') === '1' ||
    sessionStorage.getItem('volterisk-brief') === '1'
  )
}

/** Centered flashcards — noon GMT / login batch uses a 2s gap between each. */
export function SoftToast() {
  const [queue, setQueue] = useState<Card[]>([])
  const seen = useRef(new Set<string>())

  useEffect(() => {
    return subscribeDesk((snap) => {
      const fresh = snap.notifications
        .filter((n: GameNotice) => n.read !== true && TOAST_TITLES.has(n.title) && !seen.current.has(n.id))
        .reverse()
      if (fresh.length === 0) return
      for (const n of fresh) seen.current.add(n.id)
      setQueue((q) => {
        const next = [...q]
        for (const n of fresh) {
          if (!next.some((c) => c.id === n.id)) next.push({ id: n.id, title: n.title, body: n.body })
        }
        return next
      })
    })
  }, [])

  async function dismissCurrent() {
    const card = queue[0]
    if (!card) return
    setQueue((q) => {
      const rest = q.slice(1)
      if (rest.length === 0) sessionStorage.removeItem('volterisk-first-toasts')
      return rest
    })
    await api(`/api/notifications/${card.id}/read`, { method: 'POST', body: '{}' }).catch(() => undefined)
  }

  useEffect(() => {
    const front = queue[0]
    if (!front || queue.length < 2) return
    const noonBatch = queue.some((c) => NOON_TITLES.has(c.title))
    const intro = firstAccountPacing()
    if (!noonBatch && !intro) return
    if (intro) sessionStorage.setItem('volterisk-first-toasts', '1')
    const gapMs = noonBatch ? 2_000 : 5_000
    const t = window.setTimeout(() => {
      setQueue((q) => {
        if (q[0]?.id !== front.id) return q
        void api(`/api/notifications/${front.id}/read`, { method: 'POST', body: '{}' }).catch(() => undefined)
        return q.slice(1)
      })
    }, gapMs)
    return () => window.clearTimeout(t)
  }, [queue[0]?.id, queue.length])

  if (queue.length === 0) return null
  const card = queue[0]!
  const remaining = queue.length

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/75 p-4">
      <section className="animate-dossier w-full max-w-md border border-primary bg-card p-8 text-center shadow-2xl">
        {remaining > 1 ? (
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            {remaining} reports · showing 1 of {remaining}
          </p>
        ) : null}
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{card.title}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
        <button
          type="button"
          className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
          onClick={() => void dismissCurrent()}
        >
          {remaining > 1 ? 'Next' : 'Close'}
        </button>
      </section>
    </div>
  )
}
