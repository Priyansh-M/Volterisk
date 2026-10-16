import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.ts'
import { subscribeDesk } from '../lib/deskPoll.ts'
import type { GameNotice } from '../lib/types.ts'

/** These already have their own desk cards (invite, heist, heat). */
const SKIP_TITLES = new Set([
  'Game ended',
  'Roulette invite',
  'Heist Attempted',
  'You were robbed',
  'Cash seized',
  'Heat check',
])

type Card = { id: string; title: string; body: string }

/** Centered flashcards. Several unread reports sit in one box and slide with the arrows. */
export function SoftToast() {
  const [queue, setQueue] = useState<Card[]>([])
  const [index, setIndex] = useState(0)
  const seen = useRef(new Set<string>())

  useEffect(() => {
    return subscribeDesk((snap) => {
      const fresh = snap.notifications
        .filter((n: GameNotice) => n.read !== true && !SKIP_TITLES.has(n.title) && !seen.current.has(n.id))
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

  async function dismissAll() {
    const ids = queue.map((card) => card.id)
    setQueue([])
    setIndex(0)
    sessionStorage.removeItem('volterisk-first-toasts')
    await Promise.all(ids.map((id) => api(`/api/notifications/${id}/read`, { method: 'POST', body: '{}' }).catch(() => undefined)))
  }

  if (queue.length === 0) return null
  const at = Math.min(index, queue.length - 1)
  const card = queue[at]!
  const many = queue.length > 1

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/75 p-4">
      <section className="animate-dossier relative w-full max-w-md border border-primary bg-card px-12 py-8 text-center shadow-2xl">
        {many ? (
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            {at + 1} of {queue.length}
          </p>
        ) : null}
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{card.title}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
        {many ? (
          <>
            <button
              type="button"
              aria-label="Previous report"
              className="absolute top-1/2 left-2 flex h-[26px] w-[26px] -translate-y-1/2 cursor-pointer items-center justify-center bg-primary font-mono text-base leading-none text-black disabled:opacity-30"
              disabled={at === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              {'<'}
            </button>
            <button
              type="button"
              aria-label="Next report"
              className="absolute top-1/2 right-2 flex h-[26px] w-[26px] -translate-y-1/2 cursor-pointer items-center justify-center bg-primary font-mono text-base leading-none text-black disabled:opacity-30"
              disabled={at >= queue.length - 1}
              onClick={() => setIndex((i) => Math.min(queue.length - 1, i + 1))}
            >
              {'>'}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
          onClick={() => void dismissAll()}
        >
          Dismiss
        </button>
      </section>
    </div>
  )
}
