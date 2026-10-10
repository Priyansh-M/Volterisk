import { useEffect, useState } from 'react'
import { ModBuyWarning } from '../components/ModBuyWarning.tsx'
import { WeaponArt } from '../components/WeaponArt.tsx'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api, load, peek } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { WEAPON_CATALOG } from '../lib/catalog.ts'
import { money } from '../lib/format.ts'
import { modSlotUnlockHint } from '../lib/modSlots.ts'
import type { OwnedWeapon, ShopWeapon } from '../lib/types.ts'

type Arsenal = { owned: OwnedWeapon[]; shop: ShopWeapon | null; weaponModSlots?: number }

type ModsFile = {
  owned: {
    instanceId: string
    modId: string
    kind: string
    status: string
    name: string
    tier: string
    description: string
    userWeaponId?: string | null
    breaksOnRemove?: boolean
    maxDurabilityBonus?: number
  }[]
  shopWeapon: { id: string; name: string; price: number | null; description: string }[]
  weaponSlots: number
  installFees: { basic: number; intermediate: number; advanced: number }
}

export function ArsenalPage() {
  const { applyCash, me, refresh } = useAuth()
  const [arsenal, setArsenal] = useState<Arsenal | null>(() => peek<Arsenal>('/api/me/weapons'))
  const [predictors, setPredictors] = useState(
    () => peek<{ predictor: { quantity: number } }>('/api/shop')?.predictor.quantity ?? 0,
  )
  const [camera, setCamera] = useState<{ level: number; nextCost: number | null; installed: boolean } | null>(
    () => peek<{ camera: { level: number; nextCost: number | null; installed: boolean } }>('/api/shop')?.camera ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [mods, setMods] = useState<ModsFile | null>(null)
  const [pickMod, setPickMod] = useState<Record<string, string>>({})
  const [pendingBuy, setPendingBuy] = useState<{ modId: string; price: number | null } | null>(null)
  const [pendingBreakRemove, setPendingBreakRemove] = useState<{
    instanceId: string
    name: string
    description: string
  } | null>(null)

  async function reload() {
    const [weapons, shop, modFile] = await Promise.all([
      load<Arsenal>('/api/me/weapons'),
      load<{ predictor: { quantity: number }; camera: { level: number; nextCost: number | null; installed: boolean } }>(
        '/api/shop',
      ),
      load<ModsFile>('/api/mods'),
    ])
    setArsenal(weapons)
    setPredictors(shop.predictor.quantity)
    setCamera(shop.camera)
    setMods(modFile)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the arsenal.'))
  }, [])

  async function upgradeCamera() {
    setBusy('security-camera')
    setError(null)
    try {
      const paid = await api<{ cash: number; level: number; nextCost: number | null }>('/api/shop/camera/upgrade', {
        method: 'POST',
        body: '{}',
      })
      applyCash(paid.cash)
      setCamera({ level: paid.level, nextCost: paid.nextCost, installed: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The camera did not take the upgrade.')
    } finally {
      setBusy(null)
    }
  }

  async function act(path: string, weaponId: string, instanceId?: string) {
    setBusy(instanceId ?? weaponId)
    setError(null)
    try {
      const updated = await api<OwnedWeapon>(path, { method: 'POST', body: JSON.stringify({ weaponId, instanceId }) })
      const cost = arsenal?.owned.find((row) => row.instanceId === instanceId || row.id === weaponId)?.nextUpgradeCost
      if (me && path.includes('upgrade') && cost) applyCash(me.cash - cost)
      setArsenal((current) => {
        if (!current) return current
        if (path.includes('equip')) {
          return { ...current, owned: current.owned.map((row) => ({ ...row, equipped: row.instanceId === updated.instanceId })) }
        }
        return { ...current, owned: current.owned.map((row) => (row.instanceId === updated.instanceId ? updated : row)) }
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not go through.')
    } finally {
      setBusy(null)
    }
  }

  async function installOnWeapon(userWeaponId: string) {
    const instanceId = pickMod[userWeaponId]
    if (!instanceId) {
      setError('Pick a modification to install on this weapon.')
      return
    }
    setBusy(`install:${userWeaponId}`)
    setError(null)
    try {
      await api('/api/mods/weapon/install', {
        method: 'POST',
        body: JSON.stringify({ instanceId, userWeaponId }),
      })
      setPickMod((prev) => ({ ...prev, [userWeaponId]: '' }))
      await reload()
      void refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Install failed.')
    } finally {
      setBusy(null)
    }
  }

  const inventoryMods = (mods?.owned ?? []).filter((row) => row.kind === 'weapon' && row.status === 'inventory')
  const slotsPerWeapon = mods?.weaponSlots ?? arsenal?.weaponModSlots ?? 0
  const repLevel = me?.level ?? 1
  const slotHint = modSlotUnlockHint('weapon', repLevel)

  async function buyWeaponMod(modId: string, price: number | null) {
    setBusy(modId)
    setError(null)
    try {
      await api('/api/mods/buy', { method: 'POST', body: JSON.stringify({ modId }) })
      await reload()
      if (me && price != null) applyCash(me.cash - price)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Buy failed.')
    } finally {
      setBusy(null)
      setPendingBuy(null)
    }
  }

  function requestBuyWeaponMod(modId: string, price: number | null) {
    if (repLevel < 15) {
      setPendingBuy({ modId, price })
      return
    }
    void buyWeaponMod(modId, price)
  }

  const cards = (arsenal?.owned ?? [])
    .filter((row) => (row.durability ?? 1) > 0)
    .map((row) => ({
      item: WEAPON_CATALOG.find((entry) => entry.id === row.id) ?? {
        id: row.id,
        name: row.name,
        flavor: '',
        price: 0,
      },
      owned: row,
    }))

  return (
    <div className="space-y-4">
      <PageTitle kicker="Catalogue">Classified arsenal</PageTitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!arsenal && !error ? <Notice tone="muted">Unlocking the case…</Notice> : null}
      <p className="max-w-2xl text-sm text-muted-foreground">
        Modification slots are <span className="text-foreground">per weapon</span>
        {slotsPerWeapon > 0
          ? ` — each tool holds up to ${slotsPerWeapon} mod${slotsPerWeapon === 1 ? '' : 's'} (${slotHint}).`
          : ` — 0 slots per weapon (${slotHint}).`}
      </p>
      {pendingBuy ? (
        <ModBuyWarning
          busy={busy === pendingBuy.modId}
          onDismiss={() => setPendingBuy(null)}
          onBuyAnyway={() => void buyWeaponMod(pendingBuy.modId, pendingBuy.price)}
        />
      ) : null}
      {pendingBreakRemove ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-background/85 p-4">
          <section className="w-full max-w-md border border-destructive bg-card px-5 py-5 shadow-2xl">
            <p className="font-display text-2xl font-semibold uppercase tracking-wide text-destructive">
              Modification will break
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              Removing <span className="font-semibold">{pendingBreakRemove.name}</span> destroys it permanently. It
              will not return to your inventory, and the +20 durability bonus is lost.
            </p>
            {pendingBreakRemove.description ? (
              <p className="mt-2 text-xs text-muted-foreground">{pendingBreakRemove.description}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <Btn disabled={busy !== null} onClick={() => setPendingBreakRemove(null)}>
                Keep installed
              </Btn>
              <Btn
                variant="gold"
                disabled={busy !== null}
                onClick={() => {
                  const instanceId = pendingBreakRemove.instanceId
                  setBusy(instanceId)
                  setError(null)
                  api('/api/mods/weapon/remove', {
                    method: 'POST',
                    body: JSON.stringify({ instanceId }),
                  })
                    .then(() => reload())
                    .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Remove failed.'))
                    .finally(() => {
                      setBusy(null)
                      setPendingBreakRemove(null)
                    })
                }}
              >
                {busy === pendingBreakRemove.instanceId ? 'Removing…' : 'Remove and destroy'}
              </Btn>
            </div>
          </section>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.length === 0 && predictors < 1 && !camera?.installed && arsenal ? <Notice tone="muted">The case is empty.</Notice> : null}
        {camera?.installed ? (
          <article className="flex flex-col border border-line bg-panel">
            <div className="flex aspect-[11/7] items-center justify-center border-b border-line bg-panel-2 font-display text-5xl text-primary">
              SC
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h2 className="font-serif text-xl tracking-wide">Security Camera</h2>
              <p className="mt-1 text-sm text-muted">Level {camera.level}</p>
              {camera.nextCost != null ? (
                <Btn className="mt-4" variant="gold" disabled={busy !== null} onClick={() => void upgradeCamera()}>
                  {busy === 'security-camera' ? 'Upgrading…' : `Upgrade ${money(camera.nextCost)}`}
                </Btn>
              ) : (
                <p className="mt-4 text-sm text-muted">Capped.</p>
              )}
            </div>
          </article>
        ) : null}
        {predictors > 0 ? (
          <article className="flex flex-col border border-line bg-panel">
            <div className="flex aspect-[11/7] items-center justify-center border-b border-line bg-panel-2 font-display text-5xl text-primary">
              EP
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h2 className="font-serif text-xl tracking-wide">Estimate Predictor</h2>
              <p className="mt-1 text-sm text-muted">Held {predictors}</p>
            </div>
          </article>
        ) : null}
        {cards.map(({ item, owned }) => {
          const used = owned.modSlotsUsed ?? owned.installedMods?.length ?? 0
          const cap = owned.modSlots ?? slotsPerWeapon
          const free = cap - used
          return (
            <article key={owned.instanceId ?? item.id} className="flex flex-col border border-line bg-panel">
              <div className="aspect-[11/7] border-b border-line">
                <WeaponArt id={item.id} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-serif text-xl tracking-wide">{item.name}</h2>
                    {(owned.installedMods ?? []).length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {owned.installedMods!.map((mod) => (
                          <div key={mod.id} className="border border-primary/35 bg-primary/10 px-2 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] uppercase tracking-wide text-primary">{mod.name}</span>
                              <Btn
                                className="!px-2 !py-0.5 text-[10px]"
                                disabled={busy !== null}
                                onClick={() => {
                                  const inst = mods?.owned.find(
                                    (m) =>
                                      m.kind === 'weapon' &&
                                      m.status === 'installed' &&
                                      m.modId === mod.id &&
                                      m.userWeaponId === owned.instanceId,
                                  )
                                  if (!inst) {
                                    setError('Could not find that installed modification.')
                                    return
                                  }
                                  if (inst.breaksOnRemove || mod.breaksOnRemove) {
                                    setPendingBreakRemove({
                                      instanceId: inst.instanceId,
                                      name: inst.name,
                                      description: inst.description || mod.description || '',
                                    })
                                    return
                                  }
                                  setBusy(inst.instanceId)
                                  api('/api/mods/weapon/remove', {
                                    method: 'POST',
                                    body: JSON.stringify({ instanceId: inst.instanceId }),
                                  })
                                    .then(() => reload())
                                    .catch((err: unknown) =>
                                      setError(err instanceof ApiError ? err.message : 'Remove failed.'),
                                    )
                                    .finally(() => setBusy(null))
                                }}
                              >
                                Remove
                              </Btn>
                            </div>
                            {mod.description ? (
                              <p className="mt-1 text-xs leading-snug text-muted-foreground">{mod.description}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No modification installed.</p>
                    )}
                  </div>
                  {owned.equipped ? (
                    <span className="text-[10px] tracking-[0.16em] text-gold uppercase">Equipped</span>
                  ) : (
                    <span className="text-[10px] tracking-[0.16em] text-ok uppercase">Owned</span>
                  )}
                </div>
                <p className="mt-2 font-display text-xl uppercase">
                  {item.name} (L.{owned.upgradeLevel})
                </p>
                <p className="mt-1 text-sm text-muted">Attack {owned.attack ?? owned.effectiveLevel}</p>
                <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
                  Mod slots {used}/{cap} on this weapon · {slotHint}
                </p>
                {owned.maxDurability ? (
                  <div className="mt-3">
                    <div className="h-1.5 bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.max(4, Math.round(((owned.durability ?? 0) / owned.maxDurability) * 100))}%` }}
                      />
                    </div>
                    <p className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                      <span>{owned.maxDurability}</span>
                      <span>{owned.durability} left</span>
                    </p>
                  </div>
                ) : null}
                <p className="mt-2 flex-1 text-sm text-muted">{item.flavor}</p>

                {cap > 0 && free > 0 && !owned.listed ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <p className="font-mono text-[9px] uppercase text-primary">Install modification</p>
                    {inventoryMods.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Buy a basic mod below, or craft one in the Workshop.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="min-w-[12rem] flex-1 border border-border bg-background px-2 py-1 text-sm"
                          value={pickMod[owned.instanceId ?? ''] ?? ''}
                          onChange={(e) =>
                            setPickMod((prev) => ({ ...prev, [owned.instanceId ?? '']: e.target.value }))
                          }
                        >
                          <option value="">Choose mod…</option>
                          {inventoryMods.map((m) => (
                            <option key={m.instanceId} value={m.instanceId}>
                              {m.name} ({m.tier}) · install {money(mods!.installFees[m.tier as 'basic' | 'intermediate' | 'advanced'] ?? 5000)}
                            </option>
                          ))}
                        </select>
                        <Btn
                          variant="gold"
                          disabled={busy !== null || !(pickMod[owned.instanceId ?? ''] ?? '')}
                          onClick={() => void installOnWeapon(owned.instanceId!)}
                        >
                          {busy === `install:${owned.instanceId}` ? 'Installing…' : 'Install'}
                        </Btn>
                      </div>
                    )}
                  </div>
                ) : null}
                {cap === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">0 slots per weapon ({slotHint}).</p>
                ) : null}
                {cap > 0 && free <= 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">All mod slots on this weapon are full. Remove one to swap.</p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn disabled={busy !== null || owned.equipped} onClick={() => void act('/api/weapons/equip', item.id, owned.instanceId)}>
                    {owned.equipped ? 'Equipped' : 'Equip'}
                  </Btn>
                  {owned.nextUpgradeCost === null ? (
                    <span className="self-center text-sm text-muted">Capped</span>
                  ) : (
                    <Btn variant="gold" disabled={busy !== null} onClick={() => void act('/api/weapons/upgrade', item.id, owned.instanceId)}>
                      Upgrade {money(owned.nextUpgradeCost)}
                    </Btn>
                  )}
                  {owned.repairCost != null && owned.repairCost > 0 && owned.instanceId ? (
                    <Btn
                      disabled={busy !== null}
                      onClick={() => {
                        void (async () => {
                          setBusy(owned.instanceId!)
                          setError(null)
                          try {
                            const paid = await api<OwnedWeapon & { spent?: number }>('/api/weapons/repair', {
                              method: 'POST',
                              body: JSON.stringify({ instanceId: owned.instanceId }),
                            })
                            if (me && paid.spent) applyCash(me.cash - paid.spent)
                            await reload()
                          } catch (err) {
                            setError(err instanceof ApiError ? err.message : 'Repair failed.')
                          } finally {
                            setBusy(null)
                          }
                        })()
                      }}
                    >
                      {busy === owned.instanceId ? 'Repairing…' : `Repair ${money(owned.repairCost)}`}
                    </Btn>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {mods ? (
        <section className="mt-8 space-y-3 border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase text-primary">
            Shop mods (non-craftable) · {slotsPerWeapon} slot{slotsPerWeapon === 1 ? '' : 's'} per weapon ({slotHint})
          </p>
          <p className="text-sm text-muted-foreground">
            Purchased mods go to inventory. Install them on a weapon card above (cash install fee applies). Intermediate/advanced mods
            are crafted in the Workshop.
          </p>
          <div className="space-y-2">
            {mods.shopWeapon.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border border-border px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{row.name}</span>
                  <span className="ml-2 text-muted-foreground">{row.description}</span>
                </span>
                <Btn
                  disabled={busy !== null || row.price == null}
                  onClick={() => requestBuyWeaponMod(row.id, row.price)}
                >
                  Buy {row.price != null ? money(row.price) : '—'}
                </Btn>
              </div>
            ))}
            {inventoryMods.length > 0 ? (
              <div className="pt-2">
                <p className="font-mono text-[10px] uppercase text-muted-foreground">In inventory (not installed)</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {inventoryMods.map((m) => (
                    <li key={m.instanceId}>
                      <span className="text-foreground">{m.name}</span> — {m.description}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
