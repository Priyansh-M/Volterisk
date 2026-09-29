import { useEffect, useState } from 'react'
import { WeaponArt } from '../components/WeaponArt.tsx'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { WEAPON_CATALOG } from '../lib/catalog.ts'
import { money } from '../lib/format.ts'
import type { OwnedWeapon, ShopWeapon } from '../lib/types.ts'

type Arsenal = { owned: OwnedWeapon[]; shop: ShopWeapon | null }

export function ArsenalPage() {
  const { refresh } = useAuth()
  const [arsenal, setArsenal] = useState<Arsenal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setArsenal(await api<Arsenal>('/api/me/weapons'))
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the arsenal.'))
  }, [])

  async function act(path: string, weaponId: string, instanceId?: string) {
    setBusy(instanceId ?? weaponId)
    setError(null)
    try {
      await api(path, { method: 'POST', body: JSON.stringify({ weaponId, instanceId }) })
      await load()
      await refresh()
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
        {cards.length === 0 && arsenal ? <Notice tone="muted">The case is empty.</Notice> : null}
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
                <p className="mt-1 text-sm text-muted">
                  {`Attack ${owned.attack ?? owned.effectiveLevel}${owned.nextAttack != null ? ` · after upgrade ${owned.nextAttack}` : ''}`}
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn disabled={busy !== null || owned.equipped} onClick={() => void act('/api/weapons/equip', item.id, owned.instanceId)}>
                    {owned.equipped ? 'Equipped' : 'Equip'}
                  </Btn>
                  {owned.nextUpgradeCost === null ? (
                    <span className="self-center text-sm text-muted">Capped</span>
                  ) : (
                    <Btn variant="gold" disabled={busy !== null} onClick={() => void act('/api/weapons/upgrade', item.id, owned.instanceId)}>
                      Upgrade · attack {owned.nextAttack ?? owned.nextEffectiveLevel} · {money(owned.nextUpgradeCost)}
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
