import { useEffect, useState } from 'react'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { OwnedWeapon, ShopWeapon } from '../lib/types.ts'

type Arsenal = { owned: OwnedWeapon[]; shop: ShopWeapon | null }

export function ArsenalPage() {
  const { refresh } = useAuth()
  const [arsenal, setArsenal] = useState<Arsenal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setArsenal(await api<Arsenal>('/api/me/weapons'))
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the arsenal.'))
  }, [])

  async function act(path: string, weaponId: string) {
    setBusy(true)
    setError(null)
    try {
      await api(path, { method: 'POST', body: JSON.stringify({ weaponId }) })
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not go through.')
    } finally {
      setBusy(false)
    }
  }

  if (!arsenal && !error) return <p className="text-sm text-muted">Unlocking the case…</p>

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Arsenal</h1>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {arsenal?.owned.map((weapon) => (
          <article key={weapon.id} className="rounded-lg border border-line bg-panel p-4">
            <h2 className="font-serif text-xl">{weapon.name}</h2>
            <p className="mt-1 text-sm text-muted">
              Upgrade {weapon.upgradeLevel} · combat level {weapon.effectiveLevel}
              {weapon.equipped ? ' · equipped' : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {weapon.equipped ? null : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act('/api/weapons/equip', weapon.id)}
                  className="cursor-pointer rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
                >
                  Equip
                </button>
              )}
              {weapon.nextUpgradeCost === null ? (
                <span className="text-sm text-muted">Capped</span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act('/api/weapons/upgrade', weapon.id)}
                  className="cursor-pointer rounded-md bg-gold px-3 py-2 text-sm font-medium text-ink disabled:opacity-50"
                >
                  Upgrade {money(weapon.nextUpgradeCost)}
                </button>
              )}
            </div>
          </article>
        ))}
        {arsenal?.shop ? (
          <article className="rounded-lg border border-dashed border-line bg-panel p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Next weapon</p>
            <h2 className="mt-1 font-serif text-xl">{arsenal.shop.name}</h2>
            <p className="mt-1 text-sm text-muted">Starts at combat level {arsenal.shop.effectiveLevel}</p>
            <button
              type="button"
              disabled={busy || arsenal.shop.price === null}
              onClick={() => void act('/api/weapons/buy', arsenal.shop!.id)}
              className="mt-3 cursor-pointer rounded-md bg-gold px-3 py-2 text-sm font-medium text-ink disabled:opacity-50"
            >
              Buy {arsenal.shop.price === null ? '' : money(arsenal.shop.price)}
            </button>
          </article>
        ) : null}
      </div>
    </div>
  )
}
