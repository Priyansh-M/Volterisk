import { useEffect, useState } from 'react'
import { Notice, PageTitle, Panel } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, when } from '../lib/format.ts'
import type { HistoryRow, TargetBoard, WorkBoard } from '../lib/types.ts'

export function DashboardPage() {
  const { me } = useAuth()
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [targets, setTargets] = useState<number | null>(null)
  const [openContracts, setOpenContracts] = useState<number | null>(null)
  const [activeJob, setActiveJob] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api<{ heists: HistoryRow[] }>('/api/heists/history'),
      api<TargetBoard>('/api/heists/targets'),
      api<WorkBoard>('/api/work/contracts'),
    ])
      .then(([history, board, work]) => {
        setRows(history.heists.slice(0, 8))
        setTargets(board.npc.length + board.players.length)
        setOpenContracts(work.contracts.filter((row) => row.available && !row.locked).length)
        setActiveJob(work.active?.name ?? null)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the center.'))
  }, [])

  if (!me) return null

  return (
    <div className="space-y-5">
      <PageTitle kicker={`Rank #${me.rank}`}>Operations center</PageTitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Available cash" value={money(me.cash)} gold />
        <Stat label="Vault balance" value={money(me.vault.balance)} gold />
        <Stat label="Equipped weapon" value={me.equippedWeapon?.name ?? '—'} />
        <Stat label="Active base" value={me.base ? me.base.regionName : '—'} />
        <Stat label="Heist targets" value={targets === null ? '—' : String(targets)} />
        <Stat label="Open contracts" value={openContracts === null ? '—' : String(openContracts)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel>
          <p className="text-[10px] tracking-[0.22em] text-muted uppercase">Recent activity</p>
          {rows === null && !error ? <p className="mt-3 text-sm text-muted">Pulling the file…</p> : null}
          {rows && rows.length === 0 ? <p className="mt-3 text-sm text-muted">No jobs on the book yet.</p> : null}
          <ul className="mt-3 divide-y divide-line">
            {rows?.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className={`mr-2 inline-block h-1.5 w-1.5 ${row.success ? 'bg-ok' : 'bg-danger'}`} aria-hidden="true" />
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
        <div className="space-y-4">
          <Panel>
            <p className="text-[10px] tracking-[0.22em] text-muted uppercase">On the clock</p>
            <p className="mt-2 text-sm">{activeJob ?? '—'}</p>
            <p className="mt-1 text-[12px] text-muted">{activeJob ? 'One live contract.' : 'No contract is running.'}</p>
          </Panel>
          <Panel>
            <p className="text-[10px] tracking-[0.22em] text-muted uppercase">Property income</p>
            <p className="mt-2 font-serif text-2xl text-muted">—</p>
            <p className="mt-1 text-[12px] text-muted">No property income is posted.</p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <article className="border border-line bg-panel px-4 py-3">
      <p className="text-[10px] tracking-[0.18em] text-muted uppercase">{label}</p>
      <p className={`mt-1 truncate text-lg ${gold ? 'text-gold' : ''}`}>{value}</p>
    </article>
  )
}
