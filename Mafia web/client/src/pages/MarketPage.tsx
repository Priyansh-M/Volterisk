import { useEffect, useState } from 'react'
import { WeaponArt } from '../components/WeaponArt.tsx'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { WEAPON_CATALOG } from '../lib/catalog.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { OwnedWeapon, ShopWeapon } from '../lib/types.ts'

type Arsenal = { owned: OwnedWeapon[]; shop: ShopWeapon | null }
type Counter = {
  predictor: { id: string; name: string; price: number; quantity: number }
  camera: { id: string; name: string; level: number; nextCost: number | null; installed: boolean }
}

export function MarketPage() {
  const { me, refresh } = useAuth()
  const [arsenal, setArsenal] = useState<Arsenal | null>(null)
  const [counter, setCounter] = useState<Counter | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [stall, setStall] = useState<'tools' | 'luxury'>('tools')

  async function load() {
    const [weapons, shop] = await Promise.all([api<Arsenal>('/api/me/weapons'), api<Counter>('/api/shop')])
    setArsenal(weapons)
    setCounter(shop)
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the market.'))
  }, [])

  async function buy(itemId: string) {
    setBusy(itemId)
    setError(null)
    try {
      if (itemId.startsWith('weapon:')) {
        await api('/api/weapons/buy', { method: 'POST', body: JSON.stringify({ weaponId: itemId }) })
      } else {
        await api('/api/shop/buy', { method: 'POST', body: JSON.stringify({ itemId }) })
      }
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The stall refused the sale.')
    } finally {
      setBusy(null)
    }
  }

  async function upgradeCamera() {
    setBusy('camera')
    setError(null)
    try {
      await api('/api/shop/camera/upgrade', { method: 'POST', body: '{}' })
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The camera did not take the upgrade.')
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
      <div className="mb-4 flex gap-2">
        <Btn variant={stall === 'tools' ? 'gold' : 'ghost'} onClick={() => setStall('tools')}>Tools</Btn>
        <Btn variant={stall === 'luxury' ? 'gold' : 'ghost'} onClick={() => setStall('luxury')}>Luxury</Btn>
      </div>
      {stall === 'luxury' ? (
        <section className="border border-border bg-card p-8">
          <p className="font-mono text-[9px] uppercase text-primary">Sealed case</p>
          <h2 className="mt-2 font-display text-3xl font-semibold uppercase">Luxury</h2>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">The luxury counter is reserved. Stock for that case has not been filed yet.</p>
        </section>
      ) : null}
      {stall === 'tools' ? (
      <>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Cash only. The stall sells the next tool in the line, and another copy of a tool you already own. Each copy keeps its own level and durability.
      </p>
      {counter ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <article className="border border-border bg-card p-5">
            <p className="font-mono text-[9px] uppercase text-muted-foreground">Consumable</p>
            <h2 className="font-display text-2xl font-semibold uppercase">{counter.predictor.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Spend one under Inspect to read the server chance. The roll still happens on the job.</p>
            <p className="mt-3 font-mono text-sm text-primary">{money(counter.predictor.price)} · held {counter.predictor.quantity}</p>
            <Btn className="mt-4" variant="gold" disabled={busy !== null || (me !== null && me.cash < counter.predictor.price)} onClick={() => void buy(counter.predictor.id)}>
              {busy === counter.predictor.id ? 'Buying…' : 'Buy'}
            </Btn>
          </article>
          <article className="border border-border bg-card p-5">
            <p className="font-mono text-[9px] uppercase text-muted-foreground">Installed defense</p>
            <h2 className="font-display text-2xl font-semibold uppercase">{counter.camera.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Level {counter.camera.level || '—'} cuts an attacker&apos;s chance by that many points before the clamp.
            </p>
            <p className="mt-3 font-mono text-sm text-primary">
              {counter.camera.nextCost == null ? 'Capped' : money(counter.camera.nextCost)}
            </p>
            {counter.camera.installed ? (
              <Btn className="mt-4" variant="gold" disabled={busy !== null || counter.camera.nextCost == null} onClick={() => void upgradeCamera()}>
                {busy === 'camera' ? 'Upgrading…' : 'Upgrade'}
              </Btn>
            ) : (
              <Btn className="mt-4" variant="gold" disabled={busy !== null || (me !== null && counter.camera.nextCost != null && me.cash < counter.camera.nextCost)} onClick={() => void buy(counter.camera.id)}>
                {busy === counter.camera.id ? 'Buying…' : 'Buy level 1'}
              </Btn>
            )}
          </article>
        </div>
      ) : null}
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
      </>
      ) : null}
    </div>
  )
}
