import { useEffect, useState } from 'react'
import { Btn, Notice } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

type RecordCard = {
  id: string
  name: string
  description: string
  reward: number
  unlocked: boolean
  claimed: boolean
}

export function AchievementsPage() {
  const { refresh } = useAuth()
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
      await api('/api/achievements/claim', { method: 'POST', body: JSON.stringify({ id }) })
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows?.map((record, index) => (
          <article
            key={record.id}
            className={`flex min-h-64 flex-col border p-5 ${record.unlocked ? 'border-primary bg-[#efe6d4] text-[#2a241c]' : 'border-border bg-card'}`}
          >
            <div className="flex justify-between">
              <span className="font-display text-3xl">§</span>
              <span className="font-mono text-[9px]">RECORD {String(index + 1).padStart(3, '0')}</span>
            </div>
            <div className="mt-auto">
              <p className="font-mono text-[9px] uppercase opacity-70">{record.unlocked ? (record.claimed ? 'Claimed' : 'Unlocked') : 'Sealed'}</p>
              <h2 className="font-display text-2xl font-semibold uppercase">{record.name}</h2>
              <p className="mt-2 text-xs opacity-70">{record.description}</p>
              <p className="mt-3 font-mono text-[10px] uppercase">{money(record.reward)}</p>
              {record.unlocked && !record.claimed ? (
                <Btn className="mt-4" variant="gold" disabled={busy !== null} onClick={() => void claim(record.id)}>
                  {busy === record.id ? 'Filing…' : 'Claim'}
                </Btn>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
