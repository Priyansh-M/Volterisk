import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WeaponArt } from '../components/WeaponArt.tsx'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { OwnedWeapon } from '../lib/types.ts'

export function ArsenalPage() {
  const { refresh } = useAuth()
  const [owned, setOwned] = useState<OwnedWeapon[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await api<{ owned: OwnedWeapon[] }>('/api/me/weapons')
    setOwned(data.owned)
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

  if (!owned && !error) return <Notice tone="muted">Unlocking the case…</Notice>

  return (
    <div className="space-y-4">
      <PageTitle kicker="Tool yard">Arsenal</PageTitle>
      <p className="text-sm text-muted">
        Equip and upgrade what you already own. New tools are sold in the{' '}
        <Link className="text-gold" to="/market">
          Market
        </Link>
        .
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {owned && owned.length === 0 ? <Notice tone="muted">The case is empty.</Notice> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {owned?.map((weapon) => (
          <article key={weapon.id} className="overflow-hidden rounded-2xl border border-line bg-panel">
            <div className="aspect-[11/7] border-b border-line">
              <WeaponArt id={weapon.id} />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-serif text-xl">{weapon.name}</h2>
                {weapon.equipped ? (
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">
                    Equipped
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted">
                Upgrade {weapon.upgradeLevel} · combat level {weapon.effectiveLevel}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {weapon.equipped ? null : (
                  <Btn disabled={busy} onClick={() => void act('/api/weapons/equip', weapon.id)}>
                    Equip
                  </Btn>
                )}
                {weapon.nextUpgradeCost === null ? (
                  <span className="self-center text-sm text-muted">Capped</span>
                ) : (
                  <Btn variant="gold" disabled={busy} onClick={() => void act('/api/weapons/upgrade', weapon.id)}>
                    Upgrade {money(weapon.nextUpgradeCost)}
                  </Btn>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
