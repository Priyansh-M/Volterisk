import { useEffect, useState } from 'react'
import { Notice, PageTitle, Panel } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, when } from '../lib/format.ts'
import type { HistoryRow, TargetBoard, WorkBoard } from '../lib/types.ts'

type Community = {
  registeredPlayers: number
  totalMoney: number
  totalHeisted: number
  series: { at: string; totalMoney: number }[]
}

type PassiveBoard = { jobs: { name: string; qualified: boolean; selected: boolean }[] }

export function DashboardPage() {
  const { me } = useAuth()
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [targets, setTargets] = useState<number | null>(null)
  const [openContracts, setOpenContracts] = useState<number | null>(null)
  const [passive, setPassive] = useState<PassiveBoard | null>(null)
  const [community, setCommunity] = useState<Community | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ heists: HistoryRow[] }>('/api/heists/history')
      .then((history) => setRows(history.heists.slice(0, 8)))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load the center.'))
    api<TargetBoard>('/api/heists/targets')
      .then((board) => setTargets(board.npc.length + board.players.length))
      .catch(() => undefined)
    api<WorkBoard>('/api/work/contracts')
      .then((work) => setOpenContracts(work.contracts.filter((row) => row.available && !row.locked).length))
      .catch(() => undefined)
    api<PassiveBoard>('/api/work/passive')
      .then(setPassive)
      .catch(() => undefined)
    api<Community>('/api/community')
      .then(setCommunity)
      .catch(() => undefined)
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
        <Stat label="Square" value={me.base ? squareNumber(me.base.sectorId) : '—'} />
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
            <p className="text-[10px] tracking-[0.22em] text-muted uppercase">Passive job</p>
            <p className="mt-2 text-sm">{me.currentJob ? me.currentJob.name : 'None'}</p>
            <p className="mt-1 text-[12px] text-muted">
              {passive === null
                ? 'Reading the board…'
                : `${passive.jobs.filter((job) => job.qualified && !job.selected).length} other jobs you can take`}
            </p>
          </Panel>
          <Panel>
            <p className="text-[10px] tracking-[0.22em] text-muted uppercase">Heist takings</p>
            <p className="mt-2 font-serif text-2xl text-gold">{money(me.stats.totalStolen)}</p>
            <p className="mt-1 text-[12px] text-muted">Money you have taken on successful heists.</p>
          </Panel>
        </div>
      </div>
      <section className="space-y-3">
        <p className="text-[10px] tracking-[0.22em] text-muted uppercase">Community</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Registered players" value={community ? String(community.registeredPlayers) : '—'} />
          <Stat label="Total money on the site" value={community ? money(community.totalMoney) : '—'} gold />
          <Stat label="Total heisted value" value={community ? money(community.totalHeisted) : '—'} gold />
        </div>
        <Panel>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[10px] tracking-[0.22em] text-muted uppercase">Total cash on the site</p>
            <p className="font-mono text-[10px] text-muted">Every 3 days</p>
          </div>
          <p className="mt-2 font-serif text-3xl text-gold">{community ? money(community.totalMoney) : '—'}</p>
          {community ? <MoneyPlot series={community.series} /> : <p className="mt-6 text-sm text-muted">Drawing the line…</p>}
        </Panel>
      </section>
    </div>
  )
}

function MoneyPlot({ series }: { series: { at: string; totalMoney: number }[] }) {
  const width = 640
  const height = 220
  const pad = 28
  const values = series.map((point) => point.totalMoney)
  const max = Math.max(...values, 1)
  const min = 0
  const coords = series.map((point, index) => {
    const x = series.length === 1 ? width / 2 : pad + (index / (series.length - 1)) * (width - pad * 2)
    const y = height - pad - ((point.totalMoney - min) / (max - min)) * (height - pad * 2)
    return { x, y }
  })
  const line = coords.map((point) => `${point.x},${point.y}`).join(' ')
  const fill = `${pad},${height - pad} ${line} ${coords[coords.length - 1]?.x ?? pad},${height - pad}`
  const first = series[0]
  const last = series[series.length - 1]
  const label = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-56 w-full" role="img" aria-label="Total money on the site">
      <polygon points={fill} className="fill-gold/15" />
      <polyline points={line} fill="none" className="stroke-gold" strokeWidth="2.5" />
      {coords.map((point) => (
        <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3" className="fill-gold" />
      ))}
      {first ? (
        <text x={pad} y={height - 8} className="fill-muted" fontSize="11">
          {label(first.at)}
        </text>
      ) : null}
      {last && series.length > 1 ? (
        <text x={width - pad} y={height - 8} textAnchor="end" className="fill-muted" fontSize="11">
          {label(last.at)}
        </text>
      ) : null}
    </svg>
  )
}

function squareNumber(sectorId: string) {
  const match = sectorId.match(/(\d+)\s*$/)
  if (!match) return sectorId
  return String(Number(match[1]))
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <article className="border border-line bg-panel px-4 py-3">
      <p className="text-[10px] tracking-[0.18em] text-muted uppercase">{label}</p>
      <p className={`mt-1 truncate text-lg ${gold ? 'text-gold' : ''}`}>{value}</p>
    </article>
  )
}
