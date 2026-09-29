import { useEffect, useRef, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.tsx'
import { Notice, inputClass } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, remaining } from '../lib/format.ts'
import type { HeistKind, HeistResult, OwnedWeapon, Target, TargetBoard } from '../lib/types.ts'

type Quote = {
  attack: number
  defense: number
  advantage: number
  estimatedChance: number
  weaponName: string
  weaponLevel: number
  vaultTier: string
  vaultLevel: number
}

export function HeistsPage() {
  const { me, refresh } = useAuth()
  const [kind, setKind] = useState<HeistKind>('npc')
  const [board, setBoard] = useState<TargetBoard | null>(null)
  const [weapons, setWeapons] = useState<OwnedWeapon[]>([])
  const [targetId, setTargetId] = useState<string | null>(null)
  const [weaponId, setWeaponId] = useState<string | null>(null)
  const [chance, setChance] = useState<number | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [predictors, setPredictors] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<HeistResult | null>(null)
  const targetRef = useRef<string | null>(null)

  useEffect(() => {
    Promise.all([
      api<TargetBoard>('/api/heists/targets'),
      api<{ owned: OwnedWeapon[] }>('/api/me/weapons'),
      api<{ predictor: { quantity: number } }>('/api/shop'),
    ])
      .then(([targetData, weaponData, shop]) => {
        setBoard(targetData)
        setPredictors(shop.predictor.quantity)
        setWeapons(weaponData.owned)
        const equipped = weaponData.owned.find((weapon) => weapon.equipped) ?? weaponData.owned[0]
        setWeaponId(equipped?.instanceId ?? equipped?.id ?? null)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load targets.'))
  }, [])

  const targets = board ? (kind === 'npc' ? board.npc : board.players) : null
  const selected = weapons.find((row) => (row.instanceId ?? row.id) === weaponId) ?? null
  const cooling = me ? remaining(me.cooldownEndsAt) !== 'Ready' : false

  function openTarget(userId: string, prepare: boolean) {
    targetRef.current = userId
    setTargetId(userId)
    setChance(null)
    setQuote(null)
    setResult(null)
    setConfirming(prepare)
    if (!prepare || !weaponId) return
    const weapon = weapons.find((row) => (row.instanceId ?? row.id) === weaponId)
    const catalogId = weapon?.id
    if (!catalogId) return
    api<Quote>('/api/heists/quote', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId: userId,
        weaponId: catalogId,
        instanceId: weapon.instanceId,
        kind,
      }),
    })
      .then((data) => {
        if (targetRef.current === userId) setQuote(data)
      })
      .catch(() => undefined)
  }

  async function usePredictor() {
    if (!targetId || !selected?.id) return
    setBusy(true)
    setError(null)
    try {
      const data = await api<{ estimatedChance: number }>('/api/heists/estimate', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: targetId, weaponId: selected.id, kind }),
      })
      setChance(data.estimatedChance)
      const shop = await api<{ predictor: { quantity: number } }>('/api/shop')
      setPredictors(shop.predictor.quantity)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The predictor did not fire.')
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    if (!targetId || !selected) return
    setBusy(true)
    setError(null)
    try {
      const heist = await api<HeistResult & { broken?: boolean }>('/api/heists', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: targetId,
          weaponId: selected.id,
          instanceId: selected.instanceId,
          kind,
        }),
      })
      setResult(heist)
      setConfirming(false)
      await refresh()
      const [nextBoard, weaponData] = await Promise.all([
        api<TargetBoard>('/api/heists/targets'),
        api<{ owned: OwnedWeapon[] }>('/api/me/weapons'),
      ])
      setBoard(nextBoard)
      setWeapons(weaponData.owned.filter((row) => (row.durability ?? 1) > 0))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The job failed to start.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Tabs
        value={kind}
        onValueChange={(value) => {
          setKind(value as HeistKind)
          setTargetId(null)
          setConfirming(false)
          setQuote(null)
          setResult(null)
        }}
      >
        <TabsList className="border-border bg-transparent p-0">
          <TabsTrigger value="npc" className="h-8 rounded-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            NPC heists
          </TabsTrigger>
          <TabsTrigger value="player" className="h-8 rounded-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Player heists
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {targets === null && !error ? <Notice tone="muted">Reading the board…</Notice> : null}
      {targets && targets.length === 0 ? (
        <Notice tone="muted">{kind === 'npc' ? 'No crew vault is on the board.' : 'No other player vault is open.'}</Notice>
      ) : null}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {targets?.map((row, index) => (
          <Dossier
            key={row.userId}
            row={row}
            index={index}
            open={targetId === row.userId}
            cooling={cooling}
            coolLabel={me ? remaining(me.cooldownEndsAt) : ''}
            busy={busy}
            confirming={confirming && targetId === row.userId}
            weapons={weapons}
            weaponId={weaponId}
            quote={quote}
            chance={chance}
            predictors={predictors}
            weaponName={selected?.name}
            onInspect={() => openTarget(row.userId, false)}
            onPrepare={() => openTarget(row.userId, true)}
            onWeapon={(id) => {
              setWeaponId(id)
              setChance(null)
              setQuote(null)
              setConfirming(false)
            }}
            onPredict={() => void usePredictor()}
            onCommit={() => void commit()}
            onCancel={() => setConfirming(false)}
          />
        ))}
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {result ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/75 p-4">
          <section className={`animate-heist w-full max-w-md border bg-card p-8 text-center shadow-2xl ${result.success ? 'border-success' : 'border-destructive'}`}>
            <p className="font-mono text-[10px] uppercase text-muted-foreground">{result.targetUsername}</p>
            <h2 className={`mt-3 font-display text-6xl font-semibold uppercase ${result.success ? 'text-success' : 'text-destructive'}`}>
              {result.success ? 'Success' : 'Failure'}
            </h2>
            <dl className="mt-6 space-y-3 text-left text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="font-mono text-[10px] uppercase text-muted-foreground">Chance</dt>
                <dd>{result.successChance}%</dd>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="font-mono text-[10px] uppercase text-muted-foreground">Item used</dt>
                <dd>{result.weaponName}</dd>
              </div>
              {result.success ? (
                <div className="flex justify-between">
                  <dt className="font-mono text-[10px] uppercase text-muted-foreground">Money Stolen</dt>
                  <dd className="font-mono text-success">{money(result.amountStolen)}</dd>
                </div>
              ) : null}
            </dl>
            {result.broken ? <p className="mt-4 font-display text-xl uppercase text-destructive">Broken. Removed from the arsenal.</p> : null}
            <button type="button" className="nav-pill mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={() => setResult(null)}>
              Close
            </button>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function Dossier({
  row,
  index,
  open,
  cooling,
  coolLabel,
  busy,
  confirming,
  weapons,
  weaponId,
  quote,
  chance,
  predictors,
  weaponName,
  onInspect,
  onPrepare,
  onWeapon,
  onPredict,
  onCommit,
  onCancel,
}: {
  row: Target
  index: number
  open: boolean
  cooling: boolean
  coolLabel: string
  busy: boolean
  confirming: boolean
  weapons: OwnedWeapon[]
  weaponId: string | null
  quote: Quote | null
  chance: number | null
  predictors: number
  weaponName?: string
  onInspect: () => void
  onPrepare: () => void
  onWeapon: (id: string) => void
  onPredict: () => void
  onCommit: () => void
  onCancel: () => void
}) {
  const vulnerability = row.vulnerable ? 'HIGH' : 'LOW'
  const location = row.sectorId ? row.sectorId.replace('velmora-', 'SECTOR ').toUpperCase() : 'UNPLACED'
  return (
    <article className="relative overflow-hidden border border-border bg-card p-5">
      <div className="absolute top-4 right-4 font-mono text-[9px] text-destructive">FILE H-{104 + index}</div>
      <svg viewBox="0 0 24 24" className="mb-12 h-6 w-6 text-destructive" aria-hidden="true">
        <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <p className="font-mono text-[9px] uppercase text-muted-foreground">Target dossier</p>
      <h2 className="mt-1 font-display text-3xl font-semibold uppercase">{row.username}</h2>
      <div className="my-5 grid grid-cols-2 gap-4 border-y border-border py-4">
        <Cell label="Clearance" value={`Level ${row.vaultLevel}`} />
        <Cell label="Estimated wealth" value={row.estimatedWealth ?? '—'} />
        <Cell label="Location" value={location} />
        <Cell label="Vulnerability" value={vulnerability} tone={vulnerability === 'HIGH' ? 'ok' : 'bad'} />
      </div>
      <p className="mb-5 text-xs leading-5 text-muted-foreground">
        {row.regionName ? `${row.regionName}. ` : ''}
        {row.cadence === 'day' ? 'This crew can be robbed once a day. ' : row.cadence === 'week' ? 'This crew can be robbed once a week. ' : ''}
        {row.vulnerable ? 'No recent successful hit. The vault is open.' : 'A recent hit is still on the door.'}
      </p>
      <div className="flex gap-2">
        <button type="button" className="nav-pill h-9 flex-1 cursor-pointer text-xs" onClick={onInspect}>
          Inspect
        </button>
        <button
          type="button"
          disabled={!row.vulnerable || cooling || busy}
          className="gloss-gold h-9 flex-1 cursor-pointer text-xs disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onPrepare}
        >
          {cooling ? `Cooling ${coolLabel}` : 'Prepare heist'}
        </button>
      </div>
      {open ? (
        <div className="mt-5 border-t border-border pt-4">
          <label className="block font-mono text-[9px] uppercase text-muted-foreground">
            Weapon
            <select
              className={`${inputClass} mt-2 max-w-full`}
              value={weaponId ?? ''}
              onChange={(event) => onWeapon(event.target.value)}
            >
              {weapons.map((item) => (
                <option key={item.instanceId ?? item.id} value={item.instanceId ?? item.id}>
                  {item.name} (L.{item.upgradeLevel}) · attack {item.attack ?? item.effectiveLevel}
                  {item.durability != null ? ` · ${item.durability} uses` : ''}
                </option>
              ))}
            </select>
          </label>
          {confirming && quote ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[9px] uppercase text-muted-foreground">Your equipment</p>
                <p className="font-display text-xl uppercase">{quote.weaponName}</p>
                <p className="text-sm">Level {quote.weaponLevel}</p>
                <p className="text-sm">Attack power: {quote.attack}</p>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase text-muted-foreground">Target vault</p>
                <p className="font-display text-xl uppercase">{quote.vaultTier} vault</p>
                <p className="text-sm">Level {quote.vaultLevel}</p>
                <p className="text-sm">Defense: {quote.defense}</p>
              </div>
              <p className="font-mono text-xs sm:col-span-2">
                Attack advantage: {quote.advantage >= 0 ? `+${quote.advantage}` : quote.advantage}
                {chance !== null ? ` · Estimated success ${chance}%` : ''}
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="nav-pill h-9 cursor-pointer px-3 text-xs disabled:opacity-40" disabled={busy || predictors < 1} onClick={onPredict}>
              Use Estimate Predictor
            </button>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{predictors} in the case</span>
          </div>
          {chance !== null ? (
            <p className="mt-3 text-sm">
              Server chance: <span className="text-primary">{chance}%</span>
              {weaponName ? ` with ${weaponName}` : ''}
            </p>
          ) : null}
          {confirming ? (
            <div className="mt-4 flex gap-2">
              <button type="button" className="gloss-gold h-9 flex-1 cursor-pointer text-xs disabled:opacity-40" disabled={busy || !row.vulnerable || cooling} onClick={onCommit}>
                {busy ? 'Working…' : 'Confirm job'}
              </button>
              <button type="button" className="nav-pill h-9 cursor-pointer px-3 text-xs" onClick={onCancel}>
                Back off
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  const color = tone === 'ok' ? 'text-success' : tone === 'bad' ? 'text-destructive' : 'text-foreground'
  return (
    <div>
      <p className="font-mono text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm uppercase ${color}`}>{value}</p>
    </div>
  )
}
