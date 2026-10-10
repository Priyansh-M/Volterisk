import { useEffect, useMemo, useState } from 'react'
import { AssetGlyph } from '../components/AssetGlyph.tsx'
import { MaterialIcon } from '../components/MaterialIcon.tsx'
import { MaterialsHelp } from '../components/MaterialsHelp.tsx'
import { Typeahead } from '../components/Typeahead.tsx'
import { Btn, Notice } from '../components/ui.tsx'
import { ApiError, api, load, peek } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

type OwnedAsset = {
  id: string
  catalogId: string
  name: string
  note: string
  level: number
  maxLevel: number
  nextUpgradeCost: number | null
}

type Ledger = {
  properties: OwnedAsset[]
  vehicles: OwnedAsset[]
}

type MaterialRow = {
  id: string
  name: string
  rarity: string
  quantity: number
  refPrice: number
  sources: string[]
  recipes: { recipeId: string; name: string; amount: number }[]
  description: string
}

export function PropertiesPage() {
  const { applyCash, me } = useAuth()
  const [ledger, setLedger] = useState<Ledger | null>(() => peek<Ledger>('/api/properties'))
  const [tab, setTab] = useState<'properties' | 'vehicles' | 'materials'>('properties')
  const [materials, setMaterials] = useState<MaterialRow[] | null>(null)
  const [matPick, setMatPick] = useState('')
  const [rarity, setRarity] = useState<string>('all')
  const [assetPick, setAssetPick] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function reload() {
    const [led, mats] = await Promise.all([
      load<Ledger>('/api/properties'),
      load<{ materials: MaterialRow[] }>('/api/materials'),
    ])
    setLedger(led)
    setMaterials(mats.materials)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'The asset ledger did not open.'))
  }, [])

  async function upgrade(id: string) {
    setBusy(id)
    setError(null)
    try {
      const updated = await api<OwnedAsset>('/api/properties/upgrade', { method: 'POST', body: JSON.stringify({ id }) })
      const cost = [...(ledger?.properties ?? []), ...(ledger?.vehicles ?? [])].find((row) => row.id === id)?.nextUpgradeCost
      if (me && cost) applyCash(me.cash - cost)
      setLedger((current) =>
        current
          ? {
              properties: current.properties.map((row) => (row.id === updated.id ? updated : row)),
              vehicles: current.vehicles.map((row) => (row.id === updated.id ? updated : row)),
            }
          : current,
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The upgrade did not file.')
    } finally {
      setBusy(null)
    }
  }

  const rows = tab === 'properties' ? ledger?.properties : tab === 'vehicles' ? ledger?.vehicles : null
  const assetOptions = useMemo(
    () => (rows ?? []).map((r) => ({ id: r.id, label: r.name, sub: `L${r.level}` })),
    [rows],
  )
  const shownRows = (rows ?? []).filter((r) => !assetPick || r.id === assetPick)

  const ownedMats = useMemo(
    () => (materials ?? []).filter((m) => m.quantity > 0),
    [materials],
  )
  const matOptions = useMemo(
    () => ownedMats.map((m) => ({ id: m.id, label: m.name, sub: m.rarity })),
    [ownedMats],
  )
  const filteredMats = ownedMats
    .filter((m) => rarity === 'all' || m.rarity === rarity)
    .filter((m) => !matPick || m.id === matPick)
    .sort((a, b) => b.quantity - a.quantity)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Btn variant={tab === 'properties' ? 'gold' : 'ghost'} onClick={() => { setTab('properties'); setAssetPick('') }}>
            Properties
          </Btn>
          <Btn variant={tab === 'vehicles' ? 'gold' : 'ghost'} onClick={() => { setTab('vehicles'); setAssetPick('') }}>
            Vehicles
          </Btn>
          <Btn variant={tab === 'materials' ? 'gold' : 'ghost'} onClick={() => setTab('materials')}>
            Materials
          </Btn>
        </div>
        {tab === 'materials' ? <MaterialsHelp /> : null}
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!ledger && !error ? <Notice tone="muted">Opening the ledger…</Notice> : null}

      {tab === 'materials' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Typeahead
              className="min-w-[16rem] flex-1"
              options={matOptions}
              value={matPick}
              onChange={(id) => setMatPick(id)}
              placeholder="Search materials…"
            />
            {['all', 'common', 'uncommon', 'rare', 'exotic'].map((r) => (
              <Btn key={r} variant={rarity === r ? 'gold' : 'ghost'} onClick={() => setRarity(r)}>
                {r}
              </Btn>
            ))}
          </div>
          {filteredMats.length === 0 ? (
            <Notice tone="muted">No materials on hand. Heists, properties, and the market fill this shelf.</Notice>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredMats.map((m) => (
                <article key={m.id} className="border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <MaterialIcon id={m.id} className="h-12 w-12 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-[9px] uppercase text-muted-foreground">{m.rarity}</p>
                      <h2 className="font-display text-xl font-semibold uppercase">{m.name}</h2>
                      <p className="mt-1 text-sm text-primary">
                        Owned {m.quantity} · approx price {money(m.refPrice)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {(tab === 'properties' || tab === 'vehicles') && (
        <div className="mb-4">
          <Typeahead
            className="max-w-md"
            options={assetOptions}
            value={assetPick}
            onChange={(id) => setAssetPick(id)}
            placeholder={tab === 'properties' ? 'Search owned properties…' : 'Search owned vehicles…'}
          />
        </div>
      )}

      {(tab === 'properties' || tab === 'vehicles') && shownRows.length === 0 ? (
        <Notice tone="muted">
          {tab === 'properties' ? 'No property on the books. Buy one in the marketplace.' : 'No vehicle in the garage. Buy one under Automobiles.'}
        </Notice>
      ) : null}
      {(tab === 'properties' || tab === 'vehicles') && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shownRows.map((asset) => (
            <article key={asset.id} className="border border-border bg-card">
              <div className="flex h-36 items-center justify-center border-b border-border">
                <AssetGlyph id={asset.catalogId} />
              </div>
              <div className="p-5">
                <p className="font-mono text-[9px] uppercase text-muted-foreground">Level {asset.level}</p>
                <h2 className="font-display text-2xl font-semibold uppercase">{asset.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{asset.note}</p>
                {asset.nextUpgradeCost == null ? (
                  <p className="mt-4 text-sm text-muted-foreground">Level {asset.maxLevel}. No further upgrade.</p>
                ) : (
                  <Btn className="mt-4" variant="gold" disabled={busy !== null} onClick={() => void upgrade(asset.id)}>
                    {busy === asset.id ? 'Upgrading…' : `Upgrade ${money(asset.nextUpgradeCost)}`}
                  </Btn>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
