import { useEffect, useState } from 'react'
import { WeaponArt } from '../components/WeaponArt.tsx'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api, load, peek } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { WEAPON_CATALOG } from '../lib/catalog.ts'
import { money } from '../lib/format.ts'
import type { OwnedWeapon, ShopWeapon } from '../lib/types.ts'

type Arsenal = { owned: OwnedWeapon[]; shop: ShopWeapon | null }

export function ArsenalPage() {
  const { applyCash, me } = useAuth()
  const [arsenal, setArsenal] = useState<Arsenal | null>(() => peek<Arsenal>('/api/me/weapons'))
  const [predictors, setPredictors] = useState(() => peek<{ predictor: { quantity: number } }>('/api/shop')?.predictor.quantity ?? 0)
  const [camera, setCamera] = useState<{ level: number; nextCost: number | null; installed: boolean } | null>(
    () => peek<{ camera: { level: number; nextCost: number | null; installed: boolean } }>('/api/shop')?.camera ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function reload() {
    const weaponsPromise = load<Arsenal>('/api/me/weapons').then((weapons) => {
      setArsenal(weapons)
      return weapons
    })
    const shopPromise = load<{ predictor: { quantity: number }; camera: { level: number; nextCost: number | null; installed: boolean } }>('/api/shop').then((shop) => {
      setPredictors(shop.predictor.quantity)
      setCamera(shop.camera)
      return shop
    })
    await Promise.all([weaponsPromise, shopPromise])
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the arsenal.'))
  }, [])

  async function upgradeCamera() {
    setBusy('security-camera')
    setError(null)
    try {
      const paid = await api<{ cash: number; level: number; nextCost: number | null }>('/api/shop/camera/upgrade', { method: 'POST', body: '{}' })
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.length === 0 && predictors < 1 && !camera?.installed && arsenal ? <Notice tone="muted">The case is empty.</Notice> : null}
        {camera?.installed ? (
          <article className="flex flex-col border border-line bg-panel">
            <div className="flex aspect-[11/7] items-center justify-center border-b border-line bg-panel-2 font-display text-5xl text-primary">SC</div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-serif text-xl tracking-wide">Security Camera</h2>
                <span className="text-[10px] tracking-[0.16em] text-ok uppercase">Installed</span>
              </div>
              <p className="mt-1 text-sm text-muted">Level {camera.level}</p>
              <p className="mt-2 flex-1 text-sm text-muted">
                Each level subtracts that many points from an attacker&apos;s success chance by one percent for each level. Yours is level {camera.level}.
              </p>
              {camera.nextCost != null ? (
                <Btn className="mt-4" variant="gold" disabled={busy !== null} onClick={() => void upgradeCamera()}>
                  {busy === 'security-camera' ? 'Upgrading…' : `Upgrade ${money(camera.nextCost)}`}
                </Btn>
              ) : (
                <p className="mt-4 text-sm text-muted">Level 40. The camera is capped.</p>
              )}
            </div>
          </article>
        ) : null}
        {predictors > 0 ? (
          <article className="flex flex-col border border-line bg-panel">
            <div className="flex aspect-[11/7] items-center justify-center border-b border-line bg-panel-2 font-display text-5xl text-primary">EP</div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-serif text-xl tracking-wide">Estimate Predictor</h2>
                <span className="text-[10px] tracking-[0.16em] text-ok uppercase">Owned</span>
              </div>
              <p className="mt-2 font-display text-xl uppercase">Estimate Predictor</p>
              <p className="mt-1 text-sm text-muted">Held {predictors}</p>
              <p className="mt-2 flex-1 text-sm text-muted">Spend one under Inspect on a heist to read the server chance.</p>
            </div>
          </article>
        ) : null}
        {cards.map(({ item, owned }) => {
          return (
            <article key={owned.instanceId ?? item.id} className="flex flex-col border border-line bg-panel">
              <div className="aspect-[11/7] border-b border-line">
                <WeaponArt id={item.id} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-xl tracking-wide">{item.name}</h2>
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
                {owned.nextAttack != null ? (
                  <p className="mt-1 text-sm text-muted">After Upgrade → Attack {owned.nextAttack}</p>
                ) : null}
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
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
