import { useEffect, useState } from 'react'
import { Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, load, peek } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { Leaderboard } from '../lib/types.ts'

type Row = {
  rank: number
  username: string
  netWorth: number
  level: number | null
  heists: number | null
  base: string | null
}

function RankRow({ row, mine }: { row: Row; mine: boolean }) {
  return (
    <tr className={mine ? 'border-t border-line bg-gold/10 text-gold' : 'border-t border-line'}>
      <td className="px-3 py-2 tabular-nums">{row.rank}</td>
      <td className="px-3 py-2">{row.username}</td>
      <td className="px-3 py-2">{row.level ?? '—'}</td>
      <td className="px-3 py-2 text-gold">{money(row.netWorth)}</td>
      <td className="px-3 py-2">{row.heists ?? '—'}</td>
      <td className="px-3 py-2">{row.base ?? '—'}</td>
    </tr>
  )
}

function toRow(row: Leaderboard['richest'][number]): Row {
  return {
    rank: row.rank,
    username: row.username,
    netWorth: row.netWorth,
    level: row.level ?? null,
    heists: row.successfulHeists ?? null,
    base: row.base ?? null,
  }
}

function toRows(board: Leaderboard): { listed: Row[]; you: Row | null } {
  return {
    listed: board.richest.map(toRow),
    you: board.you ? toRow(board.you) : null,
  }
}

export function LeaderboardPage() {
  const { me } = useAuth()
  const [rows, setRows] = useState<{ listed: Row[]; you: Row | null } | null>(() => {
    const board = peek<Leaderboard>('/api/leaderboard')
    return board ? toRows(board) : null
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    load<Leaderboard>('/api/leaderboard')
      .then((board) => {
        if (!cancelled) setRows(toRows(board))
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
      {rows.listed.length === 0 ? <Notice tone="muted">No accounts on the book yet.</Notice> : null}
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
            {rows.listed.map((row) => (
              <RankRow key={row.username} row={row} mine={me?.username === row.username} />
            ))}
            {rows.you ? <RankRow row={rows.you} mine /> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
