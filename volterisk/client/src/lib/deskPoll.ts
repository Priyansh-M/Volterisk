import { api } from './api.ts'
import type { GameNotice } from './types.ts'

type Unlock = { id: string; name: string; description: string; reward: number }

export type DeskSnapshot = {
  notifications: GameNotice[]
  unlocked: Unlock[]
  unclaimed?: number
}

type Listener = (snap: DeskSnapshot) => void

const listeners = new Set<Listener>()
let timer: number | null = null
let inflight: Promise<void> | null = null
let last: DeskSnapshot | null = null
let visBound = false

/** One shared poll for SoftToast + LedgerAlerts. Keep light on free-tier Supabase. */
const INTERVAL_MS = 45_000

async function tick() {
  if (typeof document !== 'undefined' && document.hidden) return
  if (inflight) return
  inflight = (async () => {
    try {
      const [alerts, notes] = await Promise.all([
        api<{ unlocked: Unlock[]; unclaimed?: number }>('/api/achievements/unannounced'),
        api<{ notifications: GameNotice[] }>('/api/notifications'),
      ])
      last = {
        notifications: notes.notifications,
        unlocked: alerts.unlocked,
        unclaimed: alerts.unclaimed,
      }
      for (const fn of [...listeners]) fn(last)
    } catch {
      /* desk will try again */
    }
  })().finally(() => {
    inflight = null
  })
  await inflight
}

function onVisibility() {
  if (!document.hidden) void tick()
}

function ensure() {
  if (timer != null) return
  void tick()
  timer = window.setInterval(() => void tick(), INTERVAL_MS)
  if (!visBound) {
    document.addEventListener('visibilitychange', onVisibility)
    visBound = true
  }
}

function teardownIfIdle() {
  if (listeners.size > 0 || timer == null) return
  window.clearInterval(timer)
  timer = null
  if (visBound) {
    document.removeEventListener('visibilitychange', onVisibility)
    visBound = false
  }
}

/** Subscribe to the shared desk snapshot. Instantly gets the last snapshot if one exists. */
export function subscribeDesk(fn: Listener) {
  listeners.add(fn)
  ensure()
  if (last) fn(last)
  return () => {
    listeners.delete(fn)
    teardownIfIdle()
  }
}

/** Force a refresh after dismissing something that should update unread counts quickly. */
export function bumpDesk() {
  void tick()
}
