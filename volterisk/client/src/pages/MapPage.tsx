import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { setL11Guide } from '../components/Level11Guide.tsx'
import { WorldMap, claimErrorCopy } from '../components/WorldMap.tsx'
import { Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api, isMissing, load, peek } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { MapPin, PlayerBase, StarterClaim } from '../lib/types.ts'
import { SECTORS, type Sector } from '../lib/world.ts'

export function OnboardingChart() {
  return <ChartScreen onboarding />
}

export function MapPage() {
  return <ChartScreen />
}

function ChartScreen({ onboarding = false }: { onboarding?: boolean }) {
  const { me, refresh } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [pins, setPins] = useState<MapPin[] | null>(() => peek<{ bases: MapPin[] }>('/api/map/bases')?.bases ?? null)
  const [pinNote, setPinNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [kit, setKit] = useState<StarterClaim | null>(null)
  const [established, setEstablished] = useState<PlayerBase | null>(null)

  useEffect(() => {
    let cancelled = false
    load<{ bases: MapPin[] }>('/api/map/bases')
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

  async function claimSector(sector: Sector, name: string) {
    const firstBase = needsBase
    setBusy(true)
    setError(null)
    try {
      const result = await api<{ base: PlayerBase }>('/api/map/base', {
        method: 'POST',
        body: JSON.stringify({
          sectorId: sector.id,
          landmassId: sector.landmassId,
          regionName: sector.regionName,
          name,
        }),
      })
      setEstablished(result.base)
      if (firstBase) {
        sessionStorage.setItem('volterisk-welcome', '1')
        sessionStorage.setItem('volterisk-first-toasts', '1')
        sessionStorage.setItem('volterisk-brief', '1')
        navigate('/')
      }
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

  async function scoutSector(sector: Sector) {
    setBusy(true)
    setError(null)
    try {
      await api('/api/territory/scout', {
        method: 'POST',
        body: JSON.stringify({
          sectorId: sector.id,
          landmassId: sector.landmassId,
          regionName: sector.regionName,
        }),
      })
      setL11Guide('entails')
      navigate('/territory')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Scout did not file.')
    } finally {
      setBusy(false)
    }
  }

  const filed = established ?? me.base
  const canScout = !needsKit && !needsBase && (me.level ?? 0) >= 11

  return (
    <div className="space-y-4">
      {onboarding ? null : <PageTitle kicker="Chart">World intelligence map</PageTitle>}
      {needsKit ? (
        <section className="border border-line bg-panel p-4">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-gold uppercase">Operation initialized</p>
          <p className="mt-2 text-sm text-muted">The desk is holding $1,000 and a Rusty Crowbar. Take them, then choose a square.</p>
          <button
            type="button"
            disabled={busy}
            className="gloss-gold mt-3 cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase disabled:opacity-50"
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
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {pinNote ? <Notice tone="muted">{pinNote}</Notice> : null}
      <div className={onboarding ? '' : 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]'}>
        <WorldMap
          className={onboarding ? 'h-[calc(100vh-9rem)] min-h-[480px]' : ''}
          showHint={onboarding}
          loading={pins === null}
          focusSectorId={params.get('sector')}
          pins={pins ?? []}
          canClaim={!needsKit && needsBase}
          canScout={canScout}
          claimHint={
            needsKit
              ? 'Take the kit before you plant a flag.'
              : needsBase
                ? null
                : canScout
                  ? 'Any empty sector can be scouted for territory expansion.'
                  : 'This square is for reading. Your base is already filed.'
          }
          busy={busy}
          onClaim={(sector, name) => void claimSector(sector, name)}
          onScout={(sector) => void scoutSector(sector)}
        />
        {onboarding ? null : (
          <aside className="border border-line bg-panel p-4">
            <p className="text-[10px] tracking-[0.22em] text-muted uppercase">World intelligence</p>
            <h2 className="mt-1 font-serif text-xl tracking-[0.12em]">VOLTERISK</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Intel label="Sectors" value={String(SECTORS.length)} />
              <Intel label="Occupied" value={pins ? String(pins.length) : '—'} />
              <Intel label="Your base" value={filed ? filed.regionName : '—'} />
              <Intel label="Block" value={filed?.name?.trim() || 'Unnamed'} />
            </dl>
            {canScout ? (
              <Link
                to="/territory"
                className="mt-4 inline-block border border-gold/40 px-3 py-1.5 text-[11px] tracking-[0.14em] text-gold uppercase no-underline"
              >
                Territory desk
              </Link>
            ) : null}
            {established ? (
              <Link to="/" className="mt-4 inline-block border border-gold/40 px-3 py-1.5 text-[11px] tracking-[0.14em] text-gold uppercase no-underline">
                Open the ledger
              </Link>
            ) : null}
            <p className="mt-5 text-[11px] tracking-[0.14em] text-muted uppercase">Legend</p>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex items-center gap-2"><span className="h-3 w-3 bg-[#2e9e48]" /> Home base</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 bg-[#7c3aed]" /> Territory</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 bg-[#c45c26]" /> NPC</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 bg-[#2f5f9e]" /> Player</li>
              <li className="flex items-center gap-2"><span className="h-3 w-3 border border-[#1c1c1c] bg-[#f7f1e4]" /> Open</li>
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}

function Intel({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  )
}
