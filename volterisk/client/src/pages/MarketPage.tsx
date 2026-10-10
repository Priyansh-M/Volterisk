import { useEffect, useMemo, useState } from 'react'
import { AssetGlyph } from '../components/AssetGlyph.tsx'
import { Typeahead } from '../components/Typeahead.tsx'
import { WeaponArt } from '../components/WeaponArt.tsx'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api, load, peek } from '../lib/api.ts'
import { WEAPON_CATALOG } from '../lib/catalog.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { OwnedWeapon, ShopWeapon } from '../lib/types.ts'

type Arsenal = { owned: OwnedWeapon[]; shop: ShopWeapon | null; unlockedThrough?: number }
type SaleLot = {
  id: string
  name: string
  price: number
  note: string
  owned: boolean
  minReputation?: number | null
}

type Counter = {
  predictor: { id: string; name: string; price: number; quantity: number }
  camera: { id: string; name: string; level: number; nextCost: number | null; installed: boolean }
}

const emptyCounter: Counter = {
  predictor: { id: 'estimate-predictor', name: 'Estimate Predictor', price: 1_000, quantity: 0 },
  camera: { id: 'security-camera', name: 'Security Camera', level: 0, nextCost: 5_000, installed: false },
}

export function MarketPage() {
  const { me, refresh, applyCash } = useAuth()
  const [arsenal, setArsenal] = useState<Arsenal | null>(() => peek<Arsenal>('/api/me/weapons'))
  const [counter, setCounter] = useState<Counter | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [stall, setStall] = useState<'tools' | 'property' | 'automobiles'>('tools')
  const [lots, setLots] = useState<SaleLot[] | null>(null)
  const [motors, setMotors] = useState<SaleLot[] | null>(null)
  const [searchId, setSearchId] = useState('')

  async function reload() {
    const [weapons, shop, assets] = await Promise.all([
      load<Arsenal>('/api/me/weapons'),
      load<Counter>('/api/shop'),
      load<{ propertyCatalog: SaleLot[]; vehicleCatalog: SaleLot[] }>('/api/properties'),
    ])
    setArsenal(weapons)
    setCounter(shop)
    setLots(assets.propertyCatalog)
    setMotors(assets.vehicleCatalog)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the market.'))
  }, [])

  useEffect(() => {
    setSearchId('')
  }, [stall])

  async function buy(itemId: string) {
    setBusy(itemId)
    setError(null)
    try {
      if (itemId.startsWith('weapon:')) {
        const item = WEAPON_CATALOG.find((row) => row.id === itemId)
        await api('/api/weapons/buy', { method: 'POST', body: JSON.stringify({ weaponId: itemId }) })
        if (me && item) applyCash(me.cash - item.price)
        // Unblock UI immediately; arsenal refreshes in the background.
        setBusy(null)
        void load<Arsenal>('/api/me/weapons')
          .then(setArsenal)
          .catch(() => undefined)
        return
      } else if (itemId === 'estimate-predictor' || itemId === 'security-camera') {
        const paid = await api<{ cash: number; quantity?: number; level?: number; nextCost?: number | null }>('/api/shop/buy', {
          method: 'POST',
          body: JSON.stringify({ itemId }),
        })
        applyCash(paid.cash)
        setCounter((current) => {
          const base = current ?? emptyCounter
          if (itemId === 'estimate-predictor') {
            return { ...base, predictor: { ...base.predictor, quantity: paid.quantity ?? base.predictor.quantity + 1 } }
          }
          return {
            ...base,
            camera: { ...base.camera, installed: true, level: paid.level ?? 1, nextCost: paid.nextCost ?? base.camera.nextCost },
          }
        })
      } else {
        const lot = [...(lots ?? []), ...(motors ?? [])].find((row) => row.id === itemId)
        await api('/api/properties/buy', { method: 'POST', body: JSON.stringify({ catalogId: itemId }) })
        if (me && lot) applyCash(me.cash - lot.price)
        const mark = (rows: SaleLot[] | null) => rows?.map((row) => (row.id === itemId ? { ...row, owned: true } : row)) ?? rows
        setLots(mark)
        setMotors(mark)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The stall refused the sale.')
    } finally {
      setBusy(null)
    }
  }

  async function upgradeCamera() {
    setBusy('camera')
    setError(null)
    try {
      const paid = await api<{ cash: number; level: number; nextCost: number | null }>('/api/shop/camera/upgrade', {
        method: 'POST',
        body: '{}',
      })
      applyCash(paid.cash)
      setCounter((current) =>
        current ? { ...current, camera: { ...current.camera, installed: true, level: paid.level, nextCost: paid.nextCost } } : current,
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The camera did not take the upgrade.')
    } finally {
      setBusy(null)
    }
  }

  async function equip(weaponId: string) {
    setBusy(weaponId)
    setError(null)
    try {
      await api('/api/weapons/equip', { method: 'POST', body: JSON.stringify({ weaponId }) })
      await reload()
      void refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not equip that tool.')
    } finally {
      setBusy(null)
    }
  }

  const ownedById = new Map(arsenal?.owned.map((row) => [row.id, row]) ?? [])
  const unlockedThrough =
    arsenal?.unlockedThrough ?? arsenal?.owned.reduce((max, row) => Math.max(max, row.number), 0) ?? 0
  const nextNumber = unlockedThrough + 1
  const board = counter ?? emptyCounter

  const searchOptions = useMemo(() => {
    if (stall === 'tools') {
      return [
        { id: board.predictor.id, label: board.predictor.name, sub: 'consumable' },
        { id: board.camera.id, label: board.camera.name, sub: 'defense' },
        ...WEAPON_CATALOG.map((w) => ({ id: w.id, label: w.name, sub: w.type })),
      ]
    }
    if (stall === 'property') return (lots ?? []).map((l) => ({ id: l.id, label: l.name, sub: money(l.price) }))
    return (motors ?? []).map((l) => ({ id: l.id, label: l.name, sub: money(l.price) }))
  }, [stall, board, lots, motors])

  const filterMatch = (id: string) => !searchId || id === searchId

  return (
    <div>
      <PageTitle kicker="Night market">Market</PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Btn variant={stall === 'tools' ? 'gold' : 'ghost'} onClick={() => setStall('tools')}>
          Tools
        </Btn>
        <Btn variant={stall === 'property' ? 'gold' : 'ghost'} onClick={() => setStall('property')}>
          Property
        </Btn>
        <Btn variant={stall === 'automobiles' ? 'gold' : 'ghost'} onClick={() => setStall('automobiles')}>
          Automobiles
        </Btn>
      </div>
      <div className="mb-4 max-w-md">
        <Typeahead
          options={searchOptions}
          value={searchId}
          onChange={(id) => setSearchId(id)}
          placeholder={stall === 'tools' ? 'Search tools…' : stall === 'property' ? 'Search property…' : 'Search automobiles…'}
        />
      </div>
      {stall === 'property' ? (
        lots === null ? (
          <Notice tone="muted">Opening the counter…</Notice>
        ) : (
          <LotGrid
            lots={lots.filter((l) => filterMatch(l.id))}
            busy={busy}
            cash={me?.cash ?? 0}
            reputation={me?.level ?? 0}
            onBuy={(id) => void buy(id)}
          />
        )
      ) : null}
      {stall === 'automobiles' ? (
        motors === null ? (
          <Notice tone="muted">Opening the counter…</Notice>
        ) : (
          <LotGrid
            lots={motors.filter((l) => filterMatch(l.id))}
            busy={busy}
            cash={me?.cash ?? 0}
            reputation={me?.level ?? 0}
            onBuy={(id) => void buy(id)}
          />
        )
      ) : null}
      {stall === 'tools' ? (
        <>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            Cash only. The stall sells the next tool in the line, and another copy of a tool you already own. Each copy keeps its own
            level and durability. Player trade lives under Black Market.
          </p>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            {(filterMatch(board.predictor.id) || !searchId) && (
              <article className="overflow-hidden border border-border bg-card">
                <div className="aspect-[11/7] border-b border-border">
                  <AssetGlyph id="predictor" />
                </div>
                <div className="p-5">
                  <p className="font-mono text-[9px] uppercase text-muted-foreground">Consumable</p>
                  <h2 className="font-display text-2xl font-semibold uppercase">{board.predictor.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Spend one under Inspect to read the server chance. The roll still happens on the job.
                  </p>
                  <p className="mt-3 font-mono text-sm text-primary">
                    {money(board.predictor.price)} · held {board.predictor.quantity}
                  </p>
                  <Btn
                    className="mt-4"
                    variant="gold"
                    disabled={busy !== null || (me !== null && me.cash < board.predictor.price)}
                    onClick={() => void buy(board.predictor.id)}
                  >
                    {busy === board.predictor.id ? 'Buying…' : 'Buy'}
                  </Btn>
                </div>
              </article>
            )}
            {(filterMatch(board.camera.id) || !searchId) && (
              <article className="overflow-hidden border border-border bg-card">
                <div className="aspect-[11/7] border-b border-border">
                  <AssetGlyph id="camera" />
                </div>
                <div className="p-5">
                  <p className="font-mono text-[9px] uppercase text-muted-foreground">Installed defense</p>
                  <h2 className="font-display text-2xl font-semibold uppercase">{board.camera.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Each level subtracts that many points from an attacker&apos;s success chance.
                    {board.camera.installed ? ` Yours is level ${board.camera.level}.` : ''}
                  </p>
                  <p className="mt-3 font-mono text-sm text-primary">
                    {board.camera.nextCost == null ? 'Capped' : money(board.camera.nextCost)}
                  </p>
                  {board.camera.installed ? (
                    <Btn
                      className="mt-4"
                      variant="gold"
                      disabled={
                        busy !== null ||
                        board.camera.nextCost == null ||
                        (me !== null && board.camera.nextCost != null && me.cash < board.camera.nextCost)
                      }
                      onClick={() => void upgradeCamera()}
                    >
                      {busy === 'camera' ? 'Upgrading…' : 'Upgrade'}
                    </Btn>
                  ) : (
                    <Btn
                      className="mt-4"
                      variant="gold"
                      disabled={busy !== null || (me !== null && board.camera.nextCost != null && me.cash < board.camera.nextCost)}
                      onClick={() => void buy(board.camera.id)}
                    >
                      {busy === board.camera.id ? 'Buying…' : 'Buy level 1'}
                    </Btn>
                  )}
                </div>
              </article>
            )}
          </div>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {!arsenal && !error ? <Notice tone="muted">Lighting the stalls…</Notice> : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {WEAPON_CATALOG.filter((item) => filterMatch(item.id)).map((item) => {
              const owned = ownedById.get(item.id)
              const known = arsenal !== null
              const unlocked = item.number <= unlockedThrough
              const canBuy = known && item.price > 0 && (unlocked || item.number === nextNumber)
              const locked = known && !unlocked && item.number !== nextNumber && item.price > 0
              const chips = owned?.installedMods ?? []
              return (
                <article key={item.id} className="flex flex-col overflow-hidden border border-line bg-panel">
                  <div className="aspect-[11/7] border-b border-line">
                    <WeaponArt id={item.id} />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-serif text-xl tracking-wide">{item.name}</h2>
                        {chips.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {chips.map((mod) => (
                              <span
                                key={mod.id}
                                className="border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-primary"
                                title={mod.description ?? mod.tier}
                              >
                                {mod.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {owned?.equipped ? (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">Equipped</span>
                      ) : owned ? (
                        <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ok">Owned</span>
                      ) : unlocked ? (
                        <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ok">Unlocked</span>
                      ) : locked ? (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">Locked</span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">{item.type}</p>
                    <p className="mt-2 flex-1 text-sm text-muted">{item.flavor}</p>
                    <p className="mt-3 font-semibold text-gold">{item.price > 0 ? money(item.price) : 'Issued at signup'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {arsenal && owned && !owned.equipped ? (
                        <Btn disabled={busy !== null} onClick={() => void equip(item.id)}>
                          Equip
                        </Btn>
                      ) : null}
                      {owned && item.price > 0 ? (
                        <Btn
                          variant="gold"
                          disabled={busy !== null || (me !== null && me.cash < item.price)}
                          onClick={() => void buy(item.id)}
                        >
                          {busy === item.id ? 'Buying…' : `Another ${money(item.price)}`}
                        </Btn>
                      ) : null}
                      {!owned && canBuy ? (
                        <Btn
                          variant="gold"
                          disabled={busy !== null || (me !== null && me.cash < item.price)}
                          onClick={() => void buy(item.id)}
                        >
                          {busy === item.id ? 'Buying…' : `Buy ${money(item.price)}`}
                        </Btn>
                      ) : null}
                      {locked ? <Btn disabled>Buy previous first</Btn> : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      ) : null}
      {stall !== 'tools' && error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  )
}

function LotGrid({
  lots,
  busy,
  cash,
  reputation,
  onBuy,
}: {
  lots: SaleLot[]
  busy: string | null
  cash: number
  reputation: number
  onBuy: (id: string) => void
}) {
  if (lots.length === 0) return <Notice tone="muted">No matches.</Notice>
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {lots.map((lot) => {
        const needRep = lot.minReputation ?? 0
        const locked = needRep > 0 && reputation < needRep
        return (
          <article key={lot.id} className="border border-border bg-card">
            <div className="aspect-[11/7] border-b border-border">
              <AssetGlyph id={lot.id} />
            </div>
            <div className="p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">{lot.name}</h2>
              <p className="mt-2 min-h-10 text-sm text-muted-foreground">{lot.note}</p>
              <p className="mt-3 font-mono text-sm text-primary">{money(lot.price)}</p>
              {lot.owned ? (
                <p className="mt-4 text-sm text-success">Held. Upgrade it under Assets.</p>
              ) : locked ? (
                <p className="mt-4 text-sm text-destructive">Reputation level {needRep} required.</p>
              ) : (
                <>
                  <Btn className="mt-4" variant="gold" disabled={busy !== null || cash < lot.price} onClick={() => onBuy(lot.id)}>
                    {busy === lot.id ? 'Buying…' : `Buy ${money(lot.price)}`}
                  </Btn>
                  {cash < lot.price ? <p className="mt-2 text-xs text-destructive">Not enough cash. Check your vault.</p> : null}
                </>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
