import { useEffect, useState } from 'react'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, when } from '../lib/format.ts'
import type { HistoryRow } from '../lib/types.ts'

export function DashboardPage() {
  const { me } = useAuth()
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ heists: HistoryRow[] }>('/api/heists/history')
      .then((data) => setRows(data.heists.slice(0, 8)))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load activity.'))
  }, [])

  if (!me) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">{me.username}</h1>
        <p className="text-sm text-muted">Level {me.level}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Cash" value={money(me.cash)} gold />
        <Card label="Vault" value={`${money(me.vault.balance)} · lv ${me.vault.level}`} gold />
        <Card
          label="Equipped"
          value={me.equippedWeapon ? `${me.equippedWeapon.name} · up ${me.equippedWeapon.upgradeLevel}` : 'None'}
        />
        <Card label="Jobs" value={`${me.stats.successfulHeists} taken · ${me.stats.failedHeists} missed`} />
      </div>
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="font-serif text-xl">Recent activity</h2>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {rows === null && !error ? <p className="mt-3 text-sm text-muted">Pulling the file…</p> : null}
        {rows && rows.length === 0 ? <p className="mt-3 text-sm text-muted">No jobs yet. The crowbar is still clean.</p> : null}
        <ul className="mt-3 divide-y divide-line">
          {rows?.map((row) => (
            <li key={row.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span>
                {row.role === 'attacker'
                  ? row.success
                    ? `Took ${money(row.amountStolen)} from ${row.otherUsername}`
                    : `Missed ${row.otherUsername}`
                  : row.success
                    ? `${row.otherUsername} took ${money(row.amountStolen)}`
                    : `${row.otherUsername} tried the door`}
              </span>
              <span className="shrink-0 text-muted">{when(row.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Card({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-lg ${gold ? 'text-gold' : ''}`}>{value}</p>
    </div>
  )
}
