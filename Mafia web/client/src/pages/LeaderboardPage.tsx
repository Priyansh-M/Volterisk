import { useEffect, useState } from 'react'
import { Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { Leaderboard, PublicCard } from '../lib/types.ts'

type Row = {
  rank: number
  username: string
  netWorth: number
  level: number | null
  heists: number | null
  base: string | null
}

export function LeaderboardPage() {
  const { me } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api<Leaderboard>('/api/leaderboard')
      .then(async (board) => {
        const heists = new Map(board.heisters.map((row) => [row.username, row.successfulHeists]))
        const cards = await Promise.all(
          board.richest.map((row) =>
            api<PublicCard>(`/api/players/${encodeURIComponent(row.username)}/public`).catch(() => null),
          ),
        )
        if (cancelled) return
        setRows(
          board.richest.map((row, index) => {
            const card = cards[index]
            return {
              rank: row.rank,
              username: row.username,
              netWorth: row.netWorth,
              level: card?.level ?? null,
              heists: card?.successfulHeists ?? heists.get(row.username) ?? null,
              base: card?.base?.regionName ?? null,
            }
          }),
        )
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load the board.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <Notice tone="danger">{error}</Notice>
  if (!rows) return <Notice tone="muted">Counting the network…</Notice>

  return (
    <div className="space-y-4">
      <PageTitle kicker="Standings">Intelligence ranking</PageTitle>
      {rows.length === 0 ? <Notice tone="muted">No accounts on the book yet.</Notice> : null}
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-panel text-[10px] tracking-[0.16em] text-muted uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Operator</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">Net worth</th>
              <th className="px-3 py-2 font-medium">Heists</th>
              <th className="px-3 py-2 font-medium">Base</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const mine = me?.username === row.username
              return (
                <tr key={row.username} className={mine ? 'bg-gold/10 text-gold' : 'border-t border-line'}>
                  <td className="px-3 py-2 tabular-nums">{row.rank}</td>
                  <td className="px-3 py-2">{row.username}</td>
                  <td className="px-3 py-2">{row.level ?? '—'}</td>
                  <td className="px-3 py-2 text-gold">{money(row.netWorth)}</td>
                  <td className="px-3 py-2">{row.heists ?? '—'}</td>
                  <td className="px-3 py-2">{row.base ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
