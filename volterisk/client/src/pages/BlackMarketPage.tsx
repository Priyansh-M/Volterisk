import { useEffect, useMemo, useState } from 'react'
import { AssetGlyph } from '../components/AssetGlyph.tsx'
import { MaterialIcon } from '../components/MaterialIcon.tsx'
import { Typeahead } from '../components/Typeahead.tsx'
import { WeaponArt } from '../components/WeaponArt.tsx'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api, load } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { OwnedWeapon } from '../lib/types.ts'

const MAT_OPTIONS = [
  { id: 'mat:scrap-components', label: 'Scrap Components', sub: 'common' },
  { id: 'mat:basic-fasteners', label: 'Basic Fasteners', sub: 'common' },
  { id: 'mat:reinforced-alloy', label: 'Reinforced Alloy', sub: 'uncommon' },
  { id: 'mat:precision-parts', label: 'Precision Parts', sub: 'uncommon' },
  { id: 'mat:thermal-compound', label: 'Thermal Compound', sub: 'uncommon' },
  { id: 'mat:conductive-filament', label: 'Conductive Filament', sub: 'rare' },
  { id: 'mat:adaptive-circuitry', label: 'Adaptive Circuitry', sub: 'rare' },
  { id: 'mat:composite-weave', label: 'Composite Weave', sub: 'rare' },
  { id: 'mat:exotic-core', label: 'Exotic Core', sub: 'exotic' },
  { id: 'mat:phase-crystal', label: 'Phase Crystal', sub: 'exotic' },
  { id: 'mat:predictive-processor', label: 'Predictive Processor', sub: 'exotic' },
]

type BmListing = {
  id: string
  name: string
  note: string
  kind: string
  quantity: number
  price: number
  seller: string
  expiresAt: string
  itemId: string
  rarity?: string | null
  weaponLevel?: number | null
  durability?: number | null
  maxDurability?: number | null
}

type ModsFile = {
  owned: { instanceId: string; modId: string; kind: string; status: string; name: string; tier: string; description: string }[]
}

export function BlackMarketPage() {
  const { me, applyCash } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [searchId, setSearchId] = useState('')
  const [black, setBlack] = useState<{ listings: BmListing[]; mine: BmListing[]; feeRate: number } | null>(null)
  const [listKind, setListKind] = useState<'material' | 'mod' | 'weapon'>('material')
  const [listForm, setListForm] = useState({
    itemId: 'mat:scrap-components',
    quantity: '10',
    price: '1000',
    modOwnedId: '',
    userWeaponId: '',
  })
  const [mods, setMods] = useState<ModsFile | null>(null)
  const [weapons, setWeapons] = useState<OwnedWeapon[]>([])

  async function reload() {
    const [bm, modFile, arsenal] = await Promise.all([
      load<{ listings: BmListing[]; mine: BmListing[]; feeRate: number }>('/api/black-market'),
      load<ModsFile>('/api/mods'),
      load<{ owned: OwnedWeapon[] }>('/api/me/weapons'),
    ])
    setBlack(bm)
    setMods(modFile)
    setWeapons(arsenal.owned.filter((w) => !w.listed && (w.durability ?? 1) > 0))
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Black Market did not open.'))
  }, [])

  const inventoryMods = (mods?.owned ?? []).filter((m) => m.status === 'inventory')
  const searchOptions = useMemo(
    () => (black?.listings ?? []).map((l) => ({ id: l.id, label: l.name, sub: `${l.kind} · ${money(l.price)}` })),
    [black],
  )
  const shown = (black?.listings ?? []).filter((row) => !searchId || row.id === searchId)

  return (
    <div>
      <PageTitle kicker="Finances & Assets">Black Market</PageTitle>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Player listings for materials, modifications, and weapons. Buyer pays the ask. Seller keeps{' '}
        {black ? (100 - black.feeRate * 100).toFixed(0) : '95'}% (5% fee). Listings expire in 7 days. Weapons need at least 20%
        durability to list.
      </p>
      <div className="mb-4 max-w-md">
        <Typeahead
          options={searchOptions}
          value={searchId}
          onChange={(id) => setSearchId(id)}
          placeholder="Search listings…"
        />
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!black && !error ? <Notice tone="muted">Opening the stalls…</Notice> : null}

      {black ? (
        <div className="space-y-6">
          <section className="border border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase text-primary">Create listing</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['material', 'mod', 'weapon'] as const).map((k) => (
                <Btn key={k} variant={listKind === k ? 'gold' : 'ghost'} onClick={() => setListKind(k)}>
                  {k === 'mod' ? 'Modification' : k === 'weapon' ? 'Weapon' : 'Material'}
                </Btn>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {listKind === 'material' ? (
                <>
                  <Typeahead
                    className="min-w-[14rem] flex-1"
                    options={MAT_OPTIONS}
                    value={listForm.itemId}
                    onChange={(id) => setListForm((f) => ({ ...f, itemId: id }))}
                    placeholder="Material name…"
                  />
                  <input
                    className="w-20 border border-border bg-background px-2 py-1 text-sm"
                    value={listForm.quantity}
                    onChange={(e) => setListForm((f) => ({ ...f, quantity: e.target.value }))}
                    placeholder="qty"
                  />
                </>
              ) : null}
              {listKind === 'mod' ? (
                <Typeahead
                  className="min-w-[14rem] flex-1"
                  options={inventoryMods.map((m) => ({ id: m.instanceId, label: m.name, sub: m.tier }))}
                  value={listForm.modOwnedId}
                  onChange={(id) => setListForm((f) => ({ ...f, modOwnedId: id }))}
                  placeholder="Owned modification…"
                />
              ) : null}
              {listKind === 'weapon' ? (
                <Typeahead
                  className="min-w-[14rem] flex-1"
                  options={weapons.map((w) => ({
                    id: w.instanceId ?? '',
                    label: w.name,
                    sub: `L${w.upgradeLevel} · ${w.durability}/${w.maxDurability}`,
                  }))}
                  value={listForm.userWeaponId}
                  onChange={(id) => setListForm((f) => ({ ...f, userWeaponId: id }))}
                  placeholder="Owned weapon…"
                />
              ) : null}
              <input
                className="w-28 border border-border bg-background px-2 py-1 text-sm"
                value={listForm.price}
                onChange={(e) => setListForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="price"
              />
              <Btn
                disabled={busy !== null}
                onClick={() => {
                  setBusy('list')
                  const body =
                    listKind === 'material'
                      ? {
                          kind: 'material',
                          itemId: listForm.itemId,
                          quantity: Number(listForm.quantity),
                          price: Number(listForm.price),
                        }
                      : listKind === 'mod'
                        ? {
                            kind: 'mod',
                            modOwnedId: listForm.modOwnedId,
                            price: Number(listForm.price),
                          }
                        : {
                            kind: 'weapon',
                            userWeaponId: listForm.userWeaponId,
                            price: Number(listForm.price),
                          }
                  api('/api/black-market/list', { method: 'POST', body: JSON.stringify(body) })
                    .then(() => reload())
                    .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'List failed.'))
                    .finally(() => setBusy(null))
                }}
              >
                List
              </Btn>
            </div>
          </section>

          {shown.length === 0 ? <Notice tone="muted">No open listings.</Notice> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((row) => (
              <article key={row.id} className="flex flex-col overflow-hidden border border-border bg-card">
                <div className="aspect-[11/7] border-b border-border">
                  {row.kind === 'weapon' ? (
                    <WeaponArt id={row.itemId} />
                  ) : row.kind === 'material' ? (
                    <div className="flex h-full w-full items-center justify-center bg-background/40">
                      <MaterialIcon id={row.itemId} className="h-20 w-20 sm:h-24 sm:w-24" />
                    </div>
                  ) : (
                    <AssetGlyph id="predictor" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="font-mono text-[9px] uppercase text-muted-foreground">
                    {row.kind}
                    {row.rarity ? ` · ${row.rarity}` : ''}
                    {row.weaponLevel != null ? ` · L${row.weaponLevel}` : ''}
                  </p>
                  <h2 className="font-display text-2xl font-semibold uppercase">{row.name}</h2>
                  {row.quantity > 1 ? (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">Quantity ×{row.quantity}</p>
                  ) : null}
                  <p className="mt-2 min-h-10 flex-1 text-sm text-muted-foreground">{row.note}</p>
                  {row.durability != null && row.maxDurability != null ? (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      Durability {row.durability}/{row.maxDurability}
                    </p>
                  ) : null}
                  <p className="mt-3 font-mono text-sm text-primary">{money(row.price)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Seller {row.seller}</p>
                  <Btn
                    className="mt-4"
                    variant="gold"
                    disabled={busy !== null || row.seller === me?.username}
                    onClick={() => {
                      setBusy(row.id)
                      api<{ cash: number }>('/api/black-market/buy', {
                        method: 'POST',
                        body: JSON.stringify({ listingId: row.id }),
                      })
                        .then((paid) => {
                          applyCash(paid.cash)
                          setBlack((cur) =>
                            cur
                              ? {
                                  ...cur,
                                  listings: cur.listings.filter((l) => l.id !== row.id),
                                  mine: cur.mine.filter((l) => l.id !== row.id),
                                }
                              : cur,
                          )
                          setBusy(null)
                          void reload().catch(() => undefined)
                        })
                        .catch((err: unknown) => {
                          setError(err instanceof ApiError ? err.message : 'Buy failed.')
                          setBusy(null)
                        })
                    }}
                  >
                    {busy === row.id ? 'Buying…' : `Buy ${money(row.price)}`}
                  </Btn>
                  {row.seller === me?.username ? (
                    <p className="mt-2 text-xs text-muted-foreground">Your listing.</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {black.mine.length > 0 ? (
            <section className="space-y-2">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Your listings</p>
              {black.mine.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border border-border px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{row.name}</span>
                    {row.quantity > 1 ? ` ×${row.quantity}` : ''} · {money(row.price)}
                    <span className="ml-2 text-muted-foreground">{row.note}</span>
                  </span>
                  <Btn
                    disabled={busy !== null}
                    onClick={() => {
                      setBusy(row.id)
                      api('/api/black-market/cancel', { method: 'POST', body: JSON.stringify({ listingId: row.id }) })
                        .then(() => reload())
                        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Cancel failed.'))
                        .finally(() => setBusy(null))
                    }}
                  >
                    Cancel
                  </Btn>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
