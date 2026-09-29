import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WorldMap, claimErrorCopy } from '../components/WorldMap.tsx'
import { Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api, isMissing } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { MapPin, PlayerBase, StarterClaim } from '../lib/types.ts'
import type { Sector } from '../lib/world.ts'

export function MapPage() {
  const { me, refresh } = useAuth()
  const [pins, setPins] = useState<MapPin[] | null>(null)
  const [pinNote, setPinNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [kit, setKit] = useState<StarterClaim | null>(null)
  const [established, setEstablished] = useState<PlayerBase | null>(null)

  useEffect(() => {
    let cancelled = false
    api<{ bases: MapPin[] }>('/api/map/bases')
      .then((data) => {
        if (!cancelled) setPins(data.bases)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setPins([])
        setPinNote(isMissing(err) ? 'The chart office has no pins on file yet.' : 'The pins did not come back.')
      })
    return () => {
      cancelled = true
    }
  }, [me?.base?.sectorId])

  if (!me) return null

  const needsKit = !me.onboarding.hasClaimedStarter && !kit
  const needsBase = !me.onboarding.hasBase && !established

  async function takeKit() {
    setBusy(true)
    setError(null)
    try {
      const claim = await api<StarterClaim>('/api/onboarding/claim', { method: 'POST', body: '{}' })
      setKit(claim)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The desk did not hand over the kit.')
    } finally {
      setBusy(false)
    }
  }

  async function claimSector(sector: Sector) {
    setBusy(true)
    setError(null)
    try {
      const result = await api<{ base: PlayerBase }>('/api/map/base', {
        method: 'POST',
        body: JSON.stringify({
          sectorId: sector.id,
          landmassId: sector.landmassId,
          regionName: sector.regionName,
        }),
      })
      setEstablished(result.base)
      await refresh()
      const next = await api<{ bases: MapPin[] }>('/api/map/bases')
      setPins(next.bases)
    } catch (err) {
      setError(claimErrorCopy(err))
      if (err instanceof ApiError && (err.code === 'SECTOR_OCCUPIED' || err.code === 'ALREADY_HAS_BASE')) {
        const next = await api<{ bases: MapPin[] }>('/api/map/bases').catch(() => null)
        if (next) setPins(next.bases)
        if (err.code === 'ALREADY_HAS_BASE') await refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  const filed = established ?? me.base

  return (
    <div className="space-y-4">
      <PageTitle kicker="World chart">Map</PageTitle>
      {needsKit ? (
        <section className="rounded-2xl border border-line bg-panel p-4">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Operation initialized</p>
          <p className="mt-2 text-sm text-muted">The desk is holding $20,000 and a Rusty Crowbar. Take them, then choose a coast.</p>
          <button
            type="button"
            disabled={busy}
            className="gloss-gold mt-3 cursor-pointer rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => void takeKit()}
          >
            {busy ? 'Signing…' : 'Accept the kit'}
          </button>
        </section>
      ) : null}
      {kit && needsBase ? (
        <Notice tone="ok">
          Kit filed. {money(kit.cash)} on the ledger
          {kit.items.length ? ` and ${kit.items.map((item) => item.name).join(', ')}` : ''}. Select your base.
        </Notice>
      ) : null}
      {!needsKit && needsBase ? (
        <p className="text-sm text-muted">Select your base. Zoom in, hover a sector, and claim one that is still open.</p>
      ) : null}
      {filed && (established || !needsBase) && established ? (
        <section className="rounded-2xl border border-gold/40 bg-panel p-4">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Base established</p>
          <p className="mt-2 font-serif text-2xl">{filed.regionName}</p>
          <p className="mt-1 font-mono text-sm tracking-wide text-muted">{filed.sectorId.toUpperCase()}</p>
          <Link to="/" className="nav-pill mt-3 inline-block rounded-full px-3 py-1.5 text-sm text-paper no-underline">
            Open the ledger
          </Link>
        </section>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {pinNote ? <Notice tone="muted">{pinNote}</Notice> : null}
      {pins === null ? <Notice tone="muted">Pulling the chart…</Notice> : null}
      <WorldMap
        pins={pins ?? []}
        canClaim={!needsKit && needsBase}
        claimHint={needsKit ? 'Take the kit before you plant a flag.' : null}
        busy={busy}
        onClaim={(sector) => void claimSector(sector)}
      />
    </div>
  )
}
