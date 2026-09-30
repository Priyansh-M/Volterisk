import { useEffect, useState } from 'react'
import { Notice } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

type RecordCard = {
  id: string
  name: string
  description: string
  reward: number
  unlocked: boolean
  sealed: boolean
  claimed: boolean
}

export function AchievementsPage() {
  const { refresh, applyCash } = useAuth()
  const [rows, setRows] = useState<RecordCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const data = await api<{ achievements: RecordCard[] }>('/api/achievements')
    setRows(data.achievements)
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'The record room is shut.'))
  }, [])

  async function claim(id: string) {
    setBusy(id)
    setError(null)
    try {
      const paid = await api<{ cash: number }>('/api/achievements/claim', { method: 'POST', body: JSON.stringify({ id }) })
      applyCash(paid.cash)
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The reward did not clear.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!rows && !error ? <Notice tone="muted">Opening the archive…</Notice> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {rows?.map((record, index) => (
          <article
            key={record.id}
            className={`flex min-h-28 flex-col justify-between gap-4 border px-4 py-4 sm:flex-row sm:items-center ${
              record.claimed ? 'border-[#3a3a3a] bg-[#2a2a2a]' : 'border-border bg-card'
            }`}
          >
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
                {record.unlocked ? (record.claimed ? ' · claimed' : ' · ready') : ''}
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold uppercase">{record.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{record.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
              <p className="font-mono text-sm text-primary">{money(record.reward)}</p>
              {record.unlocked ? (
                <button
                  type="button"
                  disabled={record.claimed || busy !== null}
                  onClick={() => void claim(record.id)}
                  className={`cursor-pointer px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase disabled:cursor-default ${
                    record.claimed ? 'border border-[#4a4a4a] text-muted-foreground' : 'gloss-gold'
                  }`}
                >
                  {record.claimed ? 'Claimed' : busy === record.id ? 'Claiming…' : 'Claim'}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
