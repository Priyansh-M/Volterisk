import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, api } from '../lib/api.ts'
import { money, when } from '../lib/format.ts'
import type { Leaderboard } from '../lib/types.ts'

export function LeaderboardPage() {
  const [board, setBoard] = useState<Leaderboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Leaderboard>('/api/leaderboard')
      .then(setBoard)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the board.'))
  }, [])

  if (error) return <p className="text-sm text-danger">{error}</p>
  if (!board) return <p className="text-sm text-muted">Counting the city…</p>

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Leaderboard</h1>
      <div className="grid gap-3 lg:grid-cols-3">
        <List title="Richest">
          {board.richest.length === 0 ? <Empty /> : null}
          {board.richest.map((row) => (
            <li key={row.rank} className="flex justify-between gap-2 py-1 text-sm">
              <span>{row.rank}. {row.username}</span>
              <span className="text-gold">{money(row.netWorth)}</span>
            </li>
          ))}
        </List>
        <List title="Successful heisters">
          {board.heisters.length === 0 ? <Empty /> : null}
          {board.heisters.map((row) => (
            <li key={row.rank} className="flex justify-between gap-2 py-1 text-sm">
              <span>{row.rank}. {row.username}</span>
              <span>{row.successfulHeists}</span>
            </li>
          ))}
        </List>
        <List title="Largest single heist">
          {board.largestHeists.length === 0 ? <Empty /> : null}
          {board.largestHeists.map((row) => (
            <li key={row.rank} className="py-1 text-sm">
              <span className="text-gold">{money(row.amount)}</span>
              <span className="text-muted"> · {row.attackerUsername} from {row.targetUsername} · {when(row.createdAt)}</span>
            </li>
          ))}
        </List>
      </div>
    </div>
  )
}

function List({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <h2 className="font-serif text-xl">{title}</h2>
      <ul className="mt-3">{children}</ul>
    </section>
  )
}

function Empty() {
  return <li className="text-sm text-muted">Nothing on the book yet.</li>
}
