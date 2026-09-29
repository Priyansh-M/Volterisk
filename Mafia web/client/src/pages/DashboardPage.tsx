import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel, PageTitle, Notice } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { compactMoney, money, when } from '../lib/format.ts'
import type { HistoryRow, OwnedWeapon } from '../lib/types.ts'

export function DashboardPage() {
  const { me } = useAuth()
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [weapons, setWeapons] = useState<OwnedWeapon[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api<{ heists: HistoryRow[] }>('/api/heists/history'),
      api<{ owned: OwnedWeapon[] }>('/api/me/weapons'),
    ])
      .then(([history, arsenal]) => {
        setRows(history.heists.slice(0, 8))
        setWeapons(arsenal.owned)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load activity.'))
  }, [])

  if (!me) return null

  return (
    <div className="space-y-6">
      <PageTitle kicker="Night ledger">Your Empire</PageTitle>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Safehouse</p>
          <p className="mt-1 font-serif text-2xl">{me.username}</p>
          <p className="text-sm text-muted">
            {me.title} · Level {me.level}
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-muted">Cash</span>
              <span className="font-semibold text-gold">{compactMoney(me.cash)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted">Vault</span>
              <span className="text-gold">{compactMoney(me.vault.balance)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted">Weapons owned</span>
              <span>{weapons ? weapons.length : '—'}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted">Base</span>
              <span>{me.base ? me.base.regionName : 'Unfiled'}</span>
            </li>
            <li className="flex justify-between gap-3 text-muted/70">
              <span>Crew</span>
              <span className="text-[10px] uppercase tracking-[0.16em]">Soon</span>
            </li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/map" className="nav-pill rounded-full px-3 py-1.5 text-sm text-paper no-underline">
              Open chart
            </Link>
            <Link to="/city" className="nav-pill rounded-full px-3 py-1.5 text-sm text-paper no-underline">
              Open city
            </Link>
            <Link to="/market" className="nav-pill rounded-full px-3 py-1.5 text-sm text-paper no-underline">
              Visit market
            </Link>
          </div>
        </Panel>
        <Panel>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Recent jobs</p>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {rows === null && !error ? <p className="mt-3 text-sm text-muted">Pulling the file…</p> : null}
          {rows && rows.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No jobs yet. The crowbar is still clean.</p>
          ) : null}
          <ul className="mt-3 divide-y divide-line">
            {rows?.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span
                    className={`mr-2 inline-block h-2 w-2 rounded-full ${row.success ? 'bg-ok' : 'bg-danger'}`}
                    aria-hidden="true"
                  />
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
        </Panel>
      </div>
    </div>
  )
}
