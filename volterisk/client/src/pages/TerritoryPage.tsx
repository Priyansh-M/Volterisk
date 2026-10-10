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
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Sectors" value={`${board.usedSectors} / ${board.maxSectors}`} />
              <Stat
                label="Vault hold"
                value={money(board.vaultBalance)}
                sub={board.capitalOk ? 'Compliant' : `Need ${money(board.capitalRequired)}`}
              />
              <Stat label="Police" value={board.policeBand} sub={`${board.policeAttention}`} />
              <Stat
                label="Card"
                value={board.vaultCreditCard ? 'On' : 'Off'}
                sub={board.vaultCreditCard ? 'Spend from vault' : 'Unlocks at L11'}
              />
            </div>
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold uppercase">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}
