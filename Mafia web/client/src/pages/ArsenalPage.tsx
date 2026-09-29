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

  async function act(path: string, weaponId: string) {
    setBusy(weaponId)
    setError(null)
    try {
      await api(path, { method: 'POST', body: JSON.stringify({ weaponId }) })
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not go through.')
    } finally {
      setBusy(null)
    }
  }

  const ownedById = new Map(arsenal?.owned.map((row) => [row.id, row]) ?? [])
  const nextId = arsenal?.shop?.id ?? null

  return (
    <div className="space-y-4">
      <PageTitle kicker="Catalogue">Classified arsenal</PageTitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!arsenal && !error ? <Notice tone="muted">Unlocking the case…</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {WEAPON_CATALOG.map((item) => {
          const owned = ownedById.get(item.id)
          const canBuy = nextId === item.id && item.price > 0
          const locked = !owned && !canBuy && item.price > 0
          return (
            <article key={item.id} className="flex flex-col border border-line bg-panel">
              <div className="aspect-[11/7] border-b border-line">
                <WeaponArt id={item.id} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-xl tracking-wide">{item.name}</h2>
                  {owned?.equipped ? (
                    <span className="text-[10px] tracking-[0.16em] text-gold uppercase">Equipped</span>
                  ) : owned ? (
                    <span className="text-[10px] tracking-[0.16em] text-ok uppercase">Owned</span>
                  ) : (
                    <span className="text-[10px] tracking-[0.16em] text-muted uppercase">Locked</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted">
                  {owned
                    ? `Damage ${owned.effectiveLevel}${owned.nextEffectiveLevel != null ? ` · after upgrade ${owned.nextEffectiveLevel}` : ''}`
                    : 'Not in the case'}
                </p>
                <p className="mt-2 flex-1 text-sm text-muted">{item.flavor}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {owned ? (
                    <>
                      <Btn disabled={busy !== null || owned.equipped} onClick={() => void act('/api/weapons/equip', item.id)}>
                        {owned.equipped ? 'Equipped' : 'Equip'}
                      </Btn>
                      {owned.nextUpgradeCost === null ? (
                        <span className="self-center text-sm text-muted">Capped</span>
                      ) : (
                        <Btn variant="gold" disabled={busy !== null} onClick={() => void act('/api/weapons/upgrade', item.id)}>
                          Upgrade · damage {owned.nextEffectiveLevel} · {money(owned.nextUpgradeCost)}
                        </Btn>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted">{locked || canBuy ? 'Buy it on the marketplace.' : 'Issued with the kit.'}</p>
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
