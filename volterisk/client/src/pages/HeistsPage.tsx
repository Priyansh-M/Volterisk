import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.tsx'
import { Notice, inputClass } from '../components/ui.tsx'
import { ApiError, api, load, peek } from '../lib/api.ts'
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
  const { me, refresh, applyCash } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [kind, setKind] = useState<HeistKind>('npc')
  const [board, setBoard] = useState<TargetBoard | null>(() => peek<TargetBoard>('/api/heists/targets'))
  const [weapons, setWeapons] = useState<OwnedWeapon[]>(() => peek<{ owned: OwnedWeapon[] }>('/api/me/weapons')?.owned ?? [])
  const [targetId, setTargetId] = useState<string | null>(null)
  const [weaponId, setWeaponId] = useState<string | null>(null)
  const [chance, setChance] = useState<number | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [predictors, setPredictors] = useState(() => peek<{ predictor: { quantity: number } }>('/api/shop')?.predictor.quantity ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<HeistResult | null>(null)
  const targetRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    load<TargetBoard>('/api/heists/targets')
      .then((targetData) => {
        if (!cancelled) setBoard(targetData)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load targets.')
      })
    load<{ owned: OwnedWeapon[] }>('/api/me/weapons')
      .then((weaponData) => {
        if (cancelled) return
        setWeapons(weaponData.owned)
        const equipped = weaponData.owned.find((weapon) => weapon.equipped) ?? weaponData.owned[0]
        setWeaponId((current) => current ?? equipped?.instanceId ?? equipped?.id ?? null)
      })
      .catch(() => undefined)
    load<{ predictor: { quantity: number } }>('/api/shop')
      .then((shop) => {
        if (!cancelled) setPredictors(shop.predictor.quantity)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const previewIds = useMemo(() => {
    if (!board) return []
    const copy = [...board.players]
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1))
      const current = copy[index]
      copy[index] = copy[swap]
      copy[swap] = current
    }
    return copy.slice(0, 3).map((row) => row.userId)
  }, [board])
  const targets = board ? (kind === 'npc' ? board.npc : shownPlayers(board.players, query, pickedId, previewIds)) : null

  useEffect(() => {
    const name = params.get('player')
    const nextKind = params.get('kind')
    if (nextKind === 'npc' || nextKind === 'player') setKind(nextKind)
    if (!board || !name) return
    const pool = nextKind === 'npc' ? board.npc : board.players
    const found = pool.find((row) => row.username.toLowerCase() === name.toLowerCase())
    if (!found) return
    setKind(nextKind === 'npc' ? 'npc' : 'player')
    setPickedId(found.userId)
    setQuery(found.username)
    setTargetId(found.userId)
    setConfirming(true)
  }, [params, board])
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
    const started = Date.now()
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
      const hold = 1000 - (Date.now() - started)
      if (hold > 0) await new Promise((resolve) => window.setTimeout(resolve, hold))
      setResult(heist)
      setConfirming(false)
      if (typeof heist.cash === 'number') applyCash(heist.cash)
      await refresh().catch(() => undefined)
      const [nextBoard, weaponData] = await Promise.all([
        load<TargetBoard>('/api/heists/targets'),
        load<{ owned: OwnedWeapon[] }>('/api/me/weapons'),
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
        <TabsList className="h-11 w-fit px-1.5">
          <TabsTrigger value="npc" className="h-9 min-w-[9.5rem] rounded-sm px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            NPC heists
          </TabsTrigger>
          <TabsTrigger value="player" className="h-9 min-w-[9.5rem] rounded-sm px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Player heists
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {kind === 'player' ? (
        <div className="relative mt-4 max-w-md">
          <input
            className={inputClass}
            value={query}
            placeholder="Search a player"
            onChange={(event) => {
              setQuery(event.target.value)
              setPickedId(null)
            }}
          />
          {query.trim() && !pickedId ? (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto border border-border bg-card">
              {(board?.players ?? [])
                .filter((row) => row.username.toLowerCase().includes(query.trim().toLowerCase()))
                .slice(0, 12)
                .map((row) => (
                  <li key={row.userId}>
                    <button
                      type="button"
                      className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setPickedId(row.userId)
                        setQuery(row.username)
                        setTargetId(row.userId)
                      }}
                    >
                      {row.username}
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {targets === null && !error ? <Notice tone="muted">Reading the board…</Notice> : null}
      {targets && targets.length === 0 ? (
        <Notice tone="muted">
          {kind === 'player' && (board?.players.length ?? 0) > 0
            ? 'Search a name. Their card opens from the list.'
            : kind === 'npc'
              ? 'No crew vault is on the board.'
              : 'No other player vault is open.'}
        </Notice>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {targets?.map((row, index) => (
          <Dossier
            key={row.userId}
            row={row}
            index={index}
            open={targetId === row.userId}
            cooling={row.cadence ? Boolean(row.cooldownEndsAt && remaining(row.cooldownEndsAt) !== 'Ready') : cooling}
            coolLabel={row.cadence ? remaining(row.cooldownEndsAt ?? null) : me ? remaining(me.cooldownEndsAt) : ''}
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
            onLocate={() => {
              if (row.sectorId) navigate(`/map?sector=${encodeURIComponent(row.sectorId)}`)
            }}
          />
        ))}
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {result ? (
        <div className="heist-reveal z-[70] flex items-center justify-center bg-background/75 p-4">
          <span className="heist-reveal-line" aria-hidden="true" />
          <section className={`heist-reveal-card relative z-[1] w-full max-w-md border bg-card p-8 text-center shadow-2xl ${result.success ? 'border-success' : 'border-destructive'}`}>
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
              ) : result.penalty ? (
                <div className="flex justify-between gap-4">
                  <dt className="font-mono text-[10px] uppercase text-muted-foreground">Penalty</dt>
                  <dd className="text-right">Vault protection is off for {result.penalty.hours} hour{result.penalty.hours === 1 ? '' : 's'}.</dd>
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

function shownPlayers(players: Target[], query: string, pickedId: string | null, previewIds: string[]) {
  const needle = query.trim().toLowerCase()
  if (pickedId && !needle) return players.filter((row) => row.userId === pickedId)
  if (!needle) return players.filter((row) => previewIds.includes(row.userId))
  return players.filter((row) => row.username.toLowerCase().includes(needle))
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
  onLocate,
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
  onLocate: () => void
}) {
  const vulnerability = row.vulnerable ? 'HIGH' : 'LOW'
  const location = row.locationName?.trim() || 'Unnamed'
  return (
    <article className="relative min-h-[340px] overflow-hidden border border-border bg-card p-6">
      <div className="absolute top-4 right-4 font-mono text-[9px] text-destructive">FILE H-{104 + index}</div>
      <div className="mb-12 flex items-center gap-3">
        <button
          type="button"
          className="group flex cursor-pointer items-center gap-3 bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!row.sectorId}
          onClick={onLocate}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-destructive group-hover:text-primary" aria-hidden="true">
            <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="group-hover:text-primary">Locate</span>
        </button>
      </div>
      <p className="font-mono text-[9px] uppercase text-muted-foreground">Target dossier</p>
      <h2 className="mt-1 font-display text-4xl font-semibold uppercase">{row.username}</h2>
      <div className="my-5 grid grid-cols-2 gap-4 border-y border-border py-4">
        <Cell label="Recommended clearance" value={row.clearanceLabel ?? `Level ${row.vaultLevel}`} />
        <Cell label="Estimated wealth" value={row.estimatedWealth ?? '—'} />
        <Cell label="Location" value={location} />
        <Cell label="Vulnerability" value={vulnerability} tone={vulnerability === 'HIGH' ? 'ok' : 'bad'} />
      </div>
      <p className="mb-5 text-xs leading-5 text-muted-foreground">
        {row.regionName ? `${row.regionName}. ` : ''}
        {row.cadence ? 'This crew cools off for 2 hours after a hit. ' : ''}
        {row.vulnerable ? 'No recent successful hit. The vault is open.' : 'A recent hit is still on the door.'}
      </p>
      <div className="flex gap-2">
        <button type="button" className="nav-pill h-9 flex-1 cursor-pointer text-xs" onClick={onInspect}>
          Inspect
        </button>
        <button
          type="button"
          disabled={!row.vulnerable || cooling || busy || row.locked}
          className="gloss-gold min-h-9 flex-1 cursor-pointer px-2 text-center text-[10px] leading-tight disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onPrepare}
        >
          {row.locked
            ? 'Level 5'
            : !row.cadence && !row.vulnerable
              ? 'Cooldown : Just been robbed'
              : cooling
                ? `Cooling ${coolLabel}`
                : 'Prepare heist'}
        </button>
      </div>
      {open ? (
        <div className="mt-5 border-t border-border pt-4">
          <label className="block font-mono text-xs uppercase text-muted-foreground">
            Weapon
            <select
              className={`${inputClass} mt-2 max-w-full py-3 text-lg`}
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
              <button type="button" className="gloss-gold h-9 flex-1 cursor-pointer text-xs disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#9a9a9a] disabled:opacity-100" disabled={busy || !row.vulnerable || cooling} onClick={onCommit}>
                Confirm job
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
