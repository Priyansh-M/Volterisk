import { useEffect, useState } from 'react'
import { WeaponArt } from '../components/WeaponArt.tsx'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { WEAPON_CATALOG } from '../lib/catalog.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { OwnedWeapon, ShopWeapon } from '../lib/types.ts'

type Arsenal = { owned: OwnedWeapon[]; shop: ShopWeapon | null }

export function MarketPage() {
  const { me, refresh } = useAuth()
  const [arsenal, setArsenal] = useState<Arsenal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setArsenal(await api<Arsenal>('/api/me/weapons'))
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the market.'))
  }, [])

  async function buy(weaponId: string) {
    setBusy(weaponId)
    setError(null)
    try {
      await api('/api/weapons/buy', { method: 'POST', body: JSON.stringify({ weaponId }) })
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The stall refused the sale.')
    } finally {
      setBusy(null)
    }
  }

  async function equip(weaponId: string) {
    setBusy(weaponId)
    setError(null)
    try {
      await api('/api/weapons/equip', { method: 'POST', body: JSON.stringify({ weaponId }) })
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not equip that tool.')
    } finally {
      setBusy(null)
    }
  }

  const ownedById = new Map(arsenal?.owned.map((row) => [row.id, row]) ?? [])
  const nextId = arsenal?.shop?.id ?? null

  return (
    <div>
      <PageTitle kicker="Night market">Market</PageTitle>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Cash only. The stall sells the next tool in the line — the server will not skip a number.
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!arsenal && !error ? <Notice tone="muted">Lighting the stalls…</Notice> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {WEAPON_CATALOG.map((item) => {
          const owned = ownedById.get(item.id)
          const canBuy = nextId === item.id && item.price > 0
          const locked = !owned && !canBuy && item.price > 0
          return (
            <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-panel">
              <div className="aspect-[11/7] border-b border-line">
                <WeaponArt id={item.id} />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-xl tracking-wide">{item.name}</h2>
                  {owned?.equipped ? (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gold">Equipped</span>
                  ) : owned ? (
                    <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ok">Owned</span>
                  ) : locked ? (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">Locked</span>
                  ) : null}
                </div>
                <p className="mt-2 flex-1 text-sm text-muted">{item.flavor}</p>
                <p className="mt-3 font-semibold text-gold">{item.price > 0 ? money(item.price) : 'Issued at signup'}</p>
                <div className="mt-3">
                  {owned ? (
                    owned.equipped ? (
                      <p className="text-sm text-muted">On your person.</p>
                    ) : (
                      <Btn disabled={busy !== null} onClick={() => void equip(item.id)}>
                        Equip
                      </Btn>
                    )
                  ) : canBuy ? (
                    <Btn
                      variant="gold"
                      disabled={busy !== null || (me !== null && me.cash < item.price)}
                      onClick={() => void buy(item.id)}
                    >
                      {busy === item.id ? 'Buying…' : `Buy ${money(item.price)}`}
                    </Btn>
                  ) : item.price === 0 ? (
                    <p className="text-sm text-muted">Starter tool.</p>
                  ) : (
                    <Btn disabled>Buy previous first</Btn>
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
