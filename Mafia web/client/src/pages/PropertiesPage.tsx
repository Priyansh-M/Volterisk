import { useEffect, useState } from 'react'
import { AssetGlyph } from '../components/AssetGlyph.tsx'
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

export function PropertiesPage() {
  const { applyCash, me } = useAuth()
  const [ledger, setLedger] = useState<Ledger | null>(() => peek<Ledger>('/api/properties'))
  const [tab, setTab] = useState<'properties' | 'vehicles'>('properties')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function reload() {
    setLedger(await load<Ledger>('/api/properties'))
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
      setLedger((current) => current ? {
        properties: current.properties.map((row) => (row.id === updated.id ? updated : row)),
        vehicles: current.vehicles.map((row) => (row.id === updated.id ? updated : row)),
      } : current)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The upgrade did not file.')
    } finally {
      setBusy(null)
    }
  }

  const rows = tab === 'properties' ? ledger?.properties : ledger?.vehicles

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Btn variant={tab === 'properties' ? 'gold' : 'ghost'} onClick={() => setTab('properties')}>
          Properties
        </Btn>
        <Btn variant={tab === 'vehicles' ? 'gold' : 'ghost'} onClick={() => setTab('vehicles')}>
          Vehicles
        </Btn>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!ledger && !error ? <Notice tone="muted">Opening the ledger…</Notice> : null}
      {rows && rows.length === 0 ? (
        <Notice tone="muted">{tab === 'properties' ? 'No property on the books. Buy one in the marketplace.' : 'No vehicle in the garage. Buy one under Automobiles.'}</Notice>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows?.map((asset) => (
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
    </div>
  )
}
