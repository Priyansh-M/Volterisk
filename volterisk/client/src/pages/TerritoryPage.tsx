import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { setL11Guide } from '../components/Level11Guide.tsx'
import { Btn, Notice } from '../components/ui.tsx'
import { ApiError, api, load } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

type SpecInfo = {
  id: string
  label: string
  blurb: string
  attackBuffPercent?: number
  maxSecuredPercent?: number
  workCooldownCutMinutes?: number
  collectBonusPercent?: number
}

type Board = {
  unlocked: boolean
  unlockLevel: number
  capitalRequired: number
  capitalOk: boolean
  vaultBalance: number
  vaultCreditCard: boolean
  policeAttention: number
  policeBand: string
  vaultYieldPerDay?: number
  maxSectors: number
  usedSectors: number
  needsSpecialization: boolean
  canExpand: boolean
  stages: string[]
  passives: {
    industrial: boolean
    financial: boolean
    attackBuffPercent: number
    defenseFlat: number
    workCooldownCutMinutes: number
    collectBonusPercent: number
  }
  base: { sectorId: string; landmassId: string; regionName: string; name: string | null } | null
  holdings: {
    id: string
    sectorId: string
    landmassId: string
    regionName: string
    specialization: string | null
    mapColor: string | null
    securedAt: string
  }[]
  mapColors?: { id: string; hex: string; label: string }[]
  pigmentKits?: number
  activeOp: {
    id: string
    sectorId: string
    landmassId: string
    regionName: string
    stage: string
    completesAt: string | null
    ready: boolean
    nextStage: string | null
  } | null
  specializations: { industrial: SpecInfo; financial: SpecInfo }
}

type CareerFile = {
  primary: { id: string; label: string; blurb: string } | null
  secondary: { id: string; label: string; blurb: string } | null
  secondaryUnlocked: boolean
  switchPrimaryFee: number
  switchSecondaryFee: number
  cooldownMs: number
  canSwitchPrimary: boolean
  firstPickFree: boolean
  options: { id: string; label: string; blurb: string }[]
}

export function TerritoryPage() {
  const { applyCash, refresh } = useAuth()
  const [board, setBoard] = useState<Board | null>(null)
  const [career, setCareer] = useState<CareerFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [paintHoldingId, setPaintHoldingId] = useState<string | null>(null)
  const [paintColorId, setPaintColorId] = useState('')
  const [policeHelp, setPoliceHelp] = useState(false)

  async function reload() {
    const [data, careerData] = await Promise.all([load<Board>('/api/territory'), load<CareerFile>('/api/career')])
    setBoard(data)
    setCareer(careerData)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Territory desk did not answer.'))
  }, [])

  async function claim() {
    setBusy(true)
    setError(null)
    try {
      const next = await api<Board>('/api/territory/advance', { method: 'POST', body: '{}' })
      setBoard(next)
      setL11Guide('entails')
      setNote('Sector claimed. Lock Industrial or Financial — permanent.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Claim failed.')
    } finally {
      setBusy(false)
    }
  }

  async function abandon() {
    setBusy(true)
    setError(null)
    try {
      const next = await api<Board>('/api/territory/abandon', { method: 'POST', body: '{}' })
      setBoard(next)
      setNote('Scout abandoned.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not abandon.')
    } finally {
      setBusy(false)
    }
  }

  async function lockSpec(holdingId: string, specialization: 'industrial' | 'financial') {
    setBusy(true)
    setError(null)
    try {
      const next = await api<Board>('/api/territory/specialize', {
        method: 'POST',
        body: JSON.stringify({ holdingId, specialization }),
      })
      setBoard(next)
      setL11Guide('done')
      setNote(`${specialization} locked. Passives are live.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not lock specialization.')
    } finally {
      setBusy(false)
    }
  }

  async function pickCareer(careerId: string, which: 'primary' | 'secondary') {
    setBusy(true)
    setError(null)
    try {
      const path = which === 'primary' ? '/api/career/primary' : '/api/career/secondary'
      const next = await api<CareerFile & { cash: number }>(path, { method: 'POST', body: JSON.stringify({ careerId }) })
      setCareer(next)
      applyCash(next.cash)
      void refresh()
      setNote(`Career set: ${next.primary?.label ?? careerId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Career change failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!board && !error) return <Notice tone="muted">Opening the territory ledger…</Notice>
  if (!board) return error ? <Notice tone="danger">{error}</Notice> : null

  const pending = board.holdings.find((h) => !h.specialization) ?? null

  return (
    <div className="flex flex-col gap-4">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {note ? <Notice tone="ok">{note}</Notice> : null}

      {!board.unlocked ? (
        <section className="border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Locked</p>
          <h2 className="mt-2 font-display text-2xl font-semibold uppercase">Territory expansion</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Opens at reputation level {board.unlockLevel} ($5M fee). Claim on Reputation first.
          </p>
          <Link to="/reputation" className="mt-3 inline-block text-sm text-primary underline">
            Open Reputation
          </Link>
        </section>
      ) : (
        <>
          <section className="border border-primary/40 bg-card px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Stat label="Sectors" value={`${board.usedSectors} / ${board.maxSectors}`} />
              <Stat
                label="Vault hold"
                value={money(board.vaultBalance)}
                sub={board.capitalOk ? 'Compliant' : `Need ${money(board.capitalRequired)}`}
              />
              <Stat
                label="Police"
                value={board.policeBand}
                sub={Number.isInteger(board.policeAttention) ? String(board.policeAttention) : board.policeAttention.toFixed(1)}
                onHelp={() => setPoliceHelp((open) => !open)}
              />
              <Stat
                label="Card"
                value={board.vaultCreditCard ? 'On' : 'Off'}
                sub={board.vaultCreditCard ? 'Spend from vault' : 'Unlocks at L11'}
              />
              <Stat
                label="Vault yield"
                value={`${board.vaultYieldPerDay ?? 0}%`}
                sub="Per day · diamond · moves with police"
              />
            </div>
            {policeHelp ? (
              <div className="mt-3 space-y-4 border border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Police attention</p>
                  <p className="mt-1 text-muted-foreground">
                    A single number. The higher it climbs, the less your diamond vault earns and the more the law comes
                    after you.
                  </p>
                </div>

                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">Bands, yield &amp; vault defense</p>
                  <dl className="mt-2 divide-y divide-border/60 border border-border/60">
                    {[
                      ['0 – 24', 'Low', '0.25%/hr', '−1'],
                      ['25 – 54', 'Elevated', '0.20%/hr', '−4'],
                      ['55 – 84', 'High', '0.15%/hr', '−7'],
                      ['85 +', 'Critical', 'No yield', '−10'],
                    ].map(([range, band, yieldText, defense]) => (
                      <div key={band} className="grid grid-cols-[1.1fr_1fr_0.9fr_0.6fr] gap-2 px-3 py-1.5">
                        <dt className="font-mono text-xs text-muted-foreground">{range}</dt>
                        <dd className="font-semibold uppercase text-foreground">{band}</dd>
                        <dd className="text-right font-mono text-xs">{yieldText}</dd>
                        <dd className="text-right font-mono text-xs text-destructive">{defense}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">What moves it</p>
                  <ul className="mt-2 space-y-1">
                    <li className="flex justify-between gap-3"><span>Successful heist</span><span className="font-mono text-destructive">+3.5</span></li>
                    <li className="flex justify-between gap-3"><span>Failed heist</span><span className="font-mono text-destructive">+5</span></li>
                    <li className="flex justify-between gap-3"><span>Claim a sector</span><span className="font-mono text-destructive">+15</span></li>
                    <li className="flex justify-between gap-3"><span>Finish active work</span><span className="font-mono text-success">−2</span></li>
                    <li className="flex justify-between gap-3"><span>Every hour</span><span className="font-mono text-success">−2</span></li>
                  </ul>
                  <p className="mt-2 text-xs">Fully clears to 0 at 12:00 GMT, then again every 48 hours.</p>
                  <p className="mt-2 text-xs">
                    Low lowers your vault defense by 1. Each band after that lowers it by 3 more: Elevated −4, High −7, Critical −10.
                    That cut applies when someone heists you.
                  </p>
                </div>

                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">Consequences</p>
                  <ul className="mt-2 space-y-1.5">
                    <li>
                      <span className="font-semibold uppercase text-foreground">High (55+)</span> — Police put a{' '}
                      <span className="text-foreground">$25,000</span> bounty on you for 7 days. Every UTC day you stay at
                      High adds <span className="text-foreground">$5,000</span> to it, but the expiry never moves. Hunters
                      collect it like any other bounty.
                    </li>
                    <li>
                      <span className="font-semibold uppercase text-foreground">Critical (85+)</span> — Police seize{' '}
                      <span className="text-foreground">$50,000</span> straight from your vault, once. It can only hit
                      again after the next 48-hour reset.
                    </li>
                  </ul>
                </div>
              </div>
            ) : null}
          </section>

          {career ? (
            <section className="border border-border bg-card px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Career</p>
              {career.primary ? (
                <div className="mt-2">
                  <h2 className="font-display text-2xl font-semibold uppercase">{career.primary.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{career.primary.blurb}</p>
                  {career.secondary ? (
                    <p className="mt-2 text-sm">
                      Secondary: <span className="text-primary">{career.secondary.label}</span> (half strength)
                    </p>
                  ) : career.secondaryUnlocked ? (
                    <p className="mt-2 text-sm text-muted-foreground">Secondary slot open (Level 30+).</p>
                  ) : null}
                  {!career.canSwitchPrimary && career.cooldownMs > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Primary switch cooldown: {Math.ceil(career.cooldownMs / 3_600_000)}h
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  <h2 className="mt-2 font-display text-xl font-semibold uppercase">Choose your career</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Stays on this page after you pick. Also shown on the leaderboard.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {career.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={busy}
                        className="border border-border bg-background p-3 text-left hover:border-primary disabled:opacity-50"
                        onClick={() => void pickCareer(opt.id, 'primary')}
                      >
                        <p className="font-display text-lg uppercase">{opt.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{opt.blurb}</p>
                        <p className="mt-2 font-mono text-[10px] uppercase text-primary">
                          {career.firstPickFree ? 'Free first pick' : money(career.switchPrimaryFee)}
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {career.primary && career.secondaryUnlocked ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {career.options
                    .filter((o) => o.id !== career.primary?.id)
                    .map((opt) => (
                      <Btn
                        key={opt.id}
                        variant={career.secondary?.id === opt.id ? 'gold' : 'ghost'}
                        disabled={busy || career.secondary?.id === opt.id}
                        onClick={() => void pickCareer(opt.id, 'secondary')}
                      >
                        {career.secondary?.id === opt.id ? opt.label : `Secondary ${opt.label}`}
                      </Btn>
                    ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {(board.passives.industrial || board.passives.financial) && (
            <section className="border border-border bg-card px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Active passives</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {board.passives.industrial ? (
                  <li>
                    Industrial: +{board.passives.attackBuffPercent}% heist success · −{board.passives.defenseFlat}% enemy
                    success ({100 - board.passives.defenseFlat}% secured)
                  </li>
                ) : null}
                {board.passives.financial ? (
                  <li>
                    Financial: −{board.passives.workCooldownCutMinutes} min work cooldown · +
                    {board.passives.collectBonusPercent}% contract & passive pay
                  </li>
                ) : null}
              </ul>
            </section>
          )}

          <section className="border border-border bg-card px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Scout → Claim</p>
            <p className="mt-2 text-sm text-muted-foreground">
              On the{' '}
              <Link to="/map" className="text-primary underline">
                Map
              </Link>
              , Scout any empty sector, then Claim here. Extra holdings show purple and cannot be robbed from the map.
            </p>
          </section>

          {board.activeOp ? (
            <section className="border border-border bg-card px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Scout ready</p>
              <h2 className="mt-2 font-display text-xl font-semibold uppercase">{board.activeOp.sectorId}</h2>
              <p className="text-sm text-muted-foreground">{board.activeOp.regionName}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Btn variant="gold" disabled={busy} onClick={() => void claim()}>
                  {busy ? 'Working…' : 'Claim sector'}
                </Btn>
                <Btn variant="ghost" disabled={busy} onClick={() => void abandon()}>
                  Abandon
                </Btn>
              </div>
            </section>
          ) : (
            <Notice tone={board.canExpand ? 'ok' : 'muted'}>
              {board.needsSpecialization
                ? 'Choose Industrial or Financial for your new holding before expanding again.'
                : board.canExpand
                  ? 'No active scout. Open the Map and scout any empty sector.'
                  : !board.capitalOk
                    ? `Deposit until the vault holds at least ${money(board.capitalRequired)}.`
                    : board.usedSectors >= board.maxSectors
                      ? 'Sector cap reached for this reputation level.'
                      : 'Expansion blocked (police or other hold).'}
            </Notice>
          )}

          <section className="border border-border bg-card px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Holdings</p>
            {board.base ? (
              <div className="mt-3 border border-border px-3 py-2">
                <p className="font-mono text-[10px] uppercase text-muted-foreground">Home base</p>
                <p className="font-display text-lg uppercase">{board.base.name ?? board.base.sectorId}</p>
                <p className="text-sm text-muted-foreground">
                  {board.base.sectorId} · {board.base.regionName}
                </p>
              </div>
            ) : null}
            {board.holdings.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No expanded sectors yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border border border-border">
                {board.holdings.map((h) => (
                  <li key={h.id} className="px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm">{h.sectorId}</p>
                        <p className="text-xs text-muted-foreground">{h.regionName}</p>
                        <p className="mt-1 text-sm">
                          {h.specialization
                            ? `Locked: ${h.specialization}`
                            : 'Specialization pending'}
                        </p>
                        {h.mapColor ? (
                          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            Map colour{' '}
                            <span className="inline-block h-3 w-3 border border-border" style={{ background: h.mapColor }} />
                          </p>
                        ) : null}
                      </div>
                      {(board.pigmentKits ?? 0) > 0 ? (
                        <Btn
                          disabled={busy}
                          onClick={() => {
                            setPaintHoldingId(h.id)
                            setPaintColorId(board.mapColors?.[0]?.id ?? '')
                          }}
                        >
                          Paint sector
                        </Btn>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {(board.pigmentKits ?? 0) > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Sector Pigment Kits ready: {board.pigmentKits}. Each paint uses one kit. Legend colours (green base,
                purple territory, orange NPC, blue player) are not available.
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Craft a Sector Pigment Kit at Workshop level 10 to recolour expanded sectors.
              </p>
            )}
          </section>
        </>
      )}

      {paintHoldingId && board?.mapColors ? (
        <div className="fixed inset-0 z-[92] flex items-center justify-center bg-background/80 p-4">
          <section className="w-full max-w-lg border border-primary bg-card p-6 shadow-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Sector pigment</p>
            <h2 className="mt-2 font-display text-2xl font-semibold uppercase">Paint holding</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Uses one Sector Pigment Kit. Choose any colour below — none of these match the map legend.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {board.mapColors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  className={`border p-2 text-left text-xs ${
                    paintColorId === c.id ? 'border-primary' : 'border-border'
                  }`}
                  onClick={() => setPaintColorId(c.id)}
                >
                  <span className="mb-1 block h-6 w-full border border-border" style={{ background: c.hex }} />
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Btn
                disabled={busy}
                onClick={() => {
                  setPaintHoldingId(null)
                  setPaintColorId('')
                }}
              >
                Cancel
              </Btn>
              <Btn
                variant="gold"
                disabled={busy || !paintColorId}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    setError(null)
                    try {
                      const next = await api<Board>('/api/territory/recolor', {
                        method: 'POST',
                        body: JSON.stringify({ holdingId: paintHoldingId, colorId: paintColorId }),
                      })
                      setBoard(next)
                      setNote('Sector painted. The pigment kit was used up.')
                      setPaintHoldingId(null)
                      setPaintColorId('')
                      void refresh()
                    } catch (err) {
                      setError(err instanceof ApiError ? err.message : 'Paint failed.')
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                {busy ? 'Painting…' : 'Apply colour'}
              </Btn>
            </div>
          </section>
        </div>
      ) : null}

      {pending && board.specializations ? (
        <div className="fixed inset-0 z-[92] flex items-center justify-center bg-background/80 p-4">
          <section className="w-full max-w-lg border border-primary bg-card p-6 shadow-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">One-time choice</p>
            <h2 className="mt-2 font-display text-2xl font-semibold uppercase">Specialize {pending.sectorId}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Permanent. Account-wide while you hold this sector. Cannot be changed later.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(['industrial', 'financial'] as const).map((key) => {
                const spec = board.specializations[key]
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    className="border border-border bg-background p-4 text-left hover:border-primary disabled:opacity-50"
                    onClick={() => void lockSpec(pending.id, key)}
                  >
                    <p className="font-display text-lg uppercase">{spec.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{spec.blurb}</p>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value, sub, onHelp }: { label: string; value: string; sub?: string; onHelp?: () => void }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
        {onHelp ? (
          <button
            type="button"
            className="inline-flex h-3.5 w-3.5 items-center justify-center border border-border text-[9px] leading-none text-foreground"
            onClick={onHelp}
            aria-label={`${label} details`}
          >
            ?
          </button>
        ) : null}
      </p>
      <p className="font-display text-lg font-semibold uppercase">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}
