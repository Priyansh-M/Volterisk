import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, api } from '../lib/api.ts'
import type { MapPin, PublicCard } from '../lib/types.ts'
import {
  LANDMASSES,
  SEA_LABELS,
  SECTORS,
  WORLD,
  sectorById,
  sectorAt,
  sectorsInView,
  toPath,
  type Sector,
} from '../lib/world.ts'

type Cam = { x: number; y: number; k: number }

type Props = {
  pins: MapPin[]
  canClaim: boolean
  claimHint?: string | null
  busy: boolean
  loading?: boolean
  focusSectorId?: string | null
  onClaim: (sector: Sector, name: string) => void
  className?: string
  /** Onboarding only. The live map does not nag after login. */
  showHint?: boolean
}

function fitCamera(width: number, height: number): Cam {
  const k = Math.min(width / WORLD.width, height / WORLD.height) * 0.92
  const viewW = width / k
  const viewH = height / k
  return { k, x: (WORLD.width - viewW) / 2, y: (WORLD.height - viewH) / 2 }
}

export function WorldMap({ pins, canClaim, claimHint = null, busy, loading = false, focusSectorId = null, onClaim, className = '', showHint = false }: Props) {
  const navigate = useNavigate()
  const frame = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const camRef = useRef<Cam>({ x: 0, y: 0, k: 0.4 })
  const fitK = useRef(0.4)
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null)
  const userMoved = useRef(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, k: 0.4 })
  const [hover, setHover] = useState<Sector | null>(null)
  const [pinned, setPinned] = useState<Sector | null>(null)
  const [tip, setTip] = useState({ x: 16, y: 16 })
  const [dossier, setDossier] = useState<PublicCard | null>(null)
  const [squaresOn, setSquaresOn] = useState(false)
  const [blockName, setBlockName] = useState('')

  const pinBySector = useMemo(() => new Map(pins.map((pin) => [pin.sectorId, pin])), [pins])
  const focus = pinned ?? hover
  const focusPin = focus ? pinBySector.get(focus.id) ?? null : null
  const showSectors = size.w > 0

  useEffect(() => {
    camRef.current = cam
  }, [cam])

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const w = Math.max(Math.round(rect.width), 1)
      const h = Math.max(Math.round(rect.height), 1)
      setSize((current) => (current.w === w && current.h === h ? current : { w, h }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!focusSectorId || !size.w || !size.h) return
    const sector = sectorById.get(focusSectorId)
    if (!sector) return
    const k = Math.max(fitK.current * 2.4, 1.4)
    const next = { k, x: sector.cx - size.w / 2 / k, y: sector.cy - size.h / 2 / k }
    userMoved.current = true
    camRef.current = next
    setCam(next)
    setPinned(sector)
    setTip({ x: 24, y: 24 })
  }, [focusSectorId, size.w, size.h])

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setSquaresOn(true))
    return () => cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    if (!size.w || !size.h || userMoved.current) return
    const next = fitCamera(size.w, size.h)
    fitK.current = next.k
    camRef.current = next
    setCam(next)
  }, [size.w, size.h])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const sx = event.clientX - rect.left
      const sy = event.clientY - rect.top
      const current = camRef.current
      const worldX = current.x + sx / current.k
      const worldY = current.y + sy / current.k
      userMoved.current = true
      const nextK = Math.min(Math.max(current.k * (event.deltaY < 0 ? 1.12 : 0.9), fitK.current * 0.85), fitK.current * 14)
      const next = { k: nextK, x: worldX - sx / nextK, y: worldY - sy / nextK }
      camRef.current = next
      setCam(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [size.w])

  useEffect(() => {
    if (!pinned) {
      setDossier(null)
      return
    }
    const name = focusPin?.player.username
    if (!name || name === 'Unknown') {
      setDossier(null)
      return
    }
    setDossier(null)
    let cancelled = false
    api<PublicCard>(`/api/players/${encodeURIComponent(name)}/public`)
      .then((card) => {
        if (!cancelled) setDossier(card)
      })
      .catch(() => {
        if (!cancelled) setDossier(null)
      })
    return () => {
      cancelled = true
    }
  }, [pinned, focusPin?.player.username])

  const visible = useMemo(() => {
    if (!showSectors || cam.k <= 0) return []
    const view = { x: cam.x, y: cam.y, w: size.w / cam.k, h: size.h / cam.k }
    return LANDMASSES.flatMap((landmass) => sectorsInView(landmass.id, view))
  }, [showSectors, cam.x, cam.y, cam.k, size.w, size.h])

  function worldFromEvent(event: { clientX: number; clientY: number }) {
    const rect = svgRef.current?.getBoundingClientRect()
    const current = camRef.current
    if (!rect) return { x: 0, y: 0 }
    return {
      x: current.x + (event.clientX - rect.left) / current.k,
      y: current.y + (event.clientY - rect.top) / current.k,
    }
  }

  function placeTip(event: { clientX: number; clientY: number }) {
    const rect = frame.current?.getBoundingClientRect()
    if (!rect) return
    const x = event.clientX - rect.left + 14
    const y = event.clientY - rect.top + 14
    setTip({
      x: x + 230 > rect.width ? Math.max(8, x - 250) : x,
      y: y + 210 > rect.height ? Math.max(8, y - 220) : y,
    })
  }

  function zoomToward(worldX: number, worldY: number, factor: number) {
    userMoved.current = true
    const current = camRef.current
    const nextK = Math.min(Math.max(current.k * factor, fitK.current * 0.85), fitK.current * 14)
    const next = { k: nextK, x: worldX - size.w / 2 / nextK, y: worldY - size.h / 2 / nextK }
    camRef.current = next
    setCam(next)
  }

  function zoomBy(factor: number) {
    const current = camRef.current
    zoomToward(current.x + size.w / 2 / current.k, current.y + size.h / 2 / current.k, factor)
  }

  const labelSize = 15 / cam.k
  const seaSize = 11 / cam.k
  const card = dossier ?? focusPin?.player ?? null
  const fitted = size.w > 1 && size.h > 1
  const viewBox = fitted
    ? `${cam.x} ${cam.y} ${Math.max(size.w / cam.k, 1)} ${Math.max(size.h / cam.k, 1)}`
    : `0 0 ${WORLD.width} ${WORLD.height}`

  return (
    <div
      ref={frame}
      className={`relative h-[calc(100vh-11rem)] min-h-[720px] overflow-hidden border border-[#1c1c1c] bg-[#efe6d4] text-[#1c1c1c] select-none ${className}`}
    >
      {loading || !squaresOn ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#efe6d4]">
          <div className="text-center">
            <p className="font-mono text-[10px] tracking-[0.22em] text-[#6d6860] uppercase">Loading the chart</p>
            <p className="mt-2 font-display text-3xl font-semibold uppercase text-[#1c1c1c]">Volterisk</p>
          </div>
        </div>
      ) : null}
      <svg
        ref={svgRef}
        className="block h-full w-full touch-none"
        viewBox={viewBox}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          drag.current = { px: event.clientX, py: event.clientY, x: camRef.current.x, y: camRef.current.y, moved: false }
          try {
            svgRef.current?.setPointerCapture(event.pointerId)
          } catch {
            /* capture is optional; the click still files */
          }
        }}
        onPointerMove={(event) => {
          const active = drag.current
          if (active) {
            const dx = event.clientX - active.px
            const dy = event.clientY - active.py
            if (Math.hypot(dx, dy) > 4) {
              active.moved = true
              userMoved.current = true
            }
            if (active.moved) {
              const next = { ...camRef.current, x: active.x - dx / camRef.current.k, y: active.y - dy / camRef.current.k }
              camRef.current = next
              setCam(next)
            }
            return
          }
          if (pinned) return
          const world = worldFromEvent(event)
          const sector = sectorAt(world.x, world.y)
          setHover((current) => (current?.id === sector?.id ? current : sector))
          if (sector) placeTip(event)
        }}
        onPointerUp={(event) => {
          const active = drag.current
          drag.current = null
          if (!active || active.moved) return
          const world = worldFromEvent(event)
          const sector = sectorAt(world.x, world.y)
          setPinned(sector)
          placeTip(event)
        }}
        role="application"
        aria-label="World chart. Drag to pan, scroll to zoom, click a sector to read it."
      >
        <defs>
          <pattern id="chart-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M 22 0 L 0 0 0 22" fill="none" stroke="#3a342c" strokeWidth="1.35" />
          </pattern>
          {LANDMASSES.map((landmass) => (
            <clipPath id={`coast-${landmass.id}`} key={landmass.id}>
              <path d={toPath(landmass.polygon)} />
            </clipPath>
          ))}
        </defs>
        {LANDMASSES.map((landmass) => (
          <g key={landmass.id}>
            <path d={toPath(landmass.polygon)} fill="#f7f1e4" stroke="#141414" strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
            <g clipPath={`url(#coast-${landmass.id})`}>
              <rect x={-20} y={-20} width={WORLD.width + 40} height={WORLD.height + 40} fill="url(#chart-grid)" />
            </g>
          </g>
        ))}
        {showSectors && squaresOn
          ? LANDMASSES.map((landmass) => (
              <g key={landmass.id} clipPath={`url(#coast-${landmass.id})`}>
                {visible
                  .filter((sector) => sector.landmassId === landmass.id)
                  .map((sector) => {
                    const pin = pinBySector.get(sector.id)
                    const hot = focus?.id === sector.id
                    const selected = pinned?.id === sector.id
                    const fill = pin?.isYou
                      ? 'rgba(46, 158, 72, 0.92)'
                      : pin?.isNpc
                        ? 'rgba(196, 92, 38, 0.9)'
                        : pin
                          ? 'rgba(47, 95, 158, 0.88)'
                          : hot
                            ? 'rgba(20,20,20,0.16)'
                            : 'rgba(255,255,255,0.08)'
                    return (
                      <g key={sector.id}>
                        <rect
                          x={sector.x}
                          y={sector.y}
                          width={sector.w}
                          height={sector.h}
                          fill={fill}
                          stroke={selected ? '#ffffff' : '#1a1a1a'}
                          strokeWidth={selected ? 3.4 : hot || pin ? 1.8 : 1.25}
                          vectorEffect="non-scaling-stroke"
                        />
                        {pin ? (
                          <rect
                            x={sector.cx - 3.1}
                            y={sector.cy - 3.1}
                            width={6.2}
                            height={6.2}
                            fill={pin.isYou ? '#1f7a38' : pin.isNpc ? '#9a3f16' : '#1d4e8c'}
                            stroke={pin.isYou ? '#141414' : '#f7f4ee'}
                            strokeWidth={0.7}
                          />
                        ) : null}
                      </g>
                    )
                  })}
              </g>
            ))
          : pins.map((pin) => {
              const sector = sectorById.get(pin.sectorId)
              if (!sector) return null
              return (
                <rect
                  key={pin.sectorId}
                  x={sector.cx - 4.5 / cam.k}
                  y={sector.cy - 4.5 / cam.k}
                  width={9 / cam.k}
                  height={9 / cam.k}
                  fill={pin.isYou ? '#2e9e48' : pin.isNpc ? '#c45c26' : '#2f5f9e'}
                  stroke="#f4f1ea"
                  strokeWidth={0.8}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
        {!showSectors
          ? LANDMASSES.map((landmass) => (
              <text
                key={landmass.id}
                x={landmass.label[0]}
                y={landmass.label[1]}
                textAnchor="middle"
                fill="#1c1c1c"
                fontFamily="Outfit, sans-serif"
                fontSize={labelSize}
                letterSpacing={1.6 / cam.k}
              >
                {landmass.name.toUpperCase()}
              </text>
            ))
          : null}
        {SEA_LABELS.map((sea) => (
          <text
            key={sea.name}
            x={sea.at[0]}
            y={sea.at[1]}
            textAnchor="middle"
            fill="#8d877c"
            fontFamily="Outfit, sans-serif"
            fontSize={seaSize}
            letterSpacing={1.4 / cam.k}
          >
            {sea.name.toUpperCase()}
          </text>
        ))}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 border border-[#1c1c1c]/30 bg-[#f7f4ee]/90 px-2.5 py-2 text-[#1c1c1c]">
        <p className="font-serif text-[13px] tracking-[0.22em]">VOLTERISK</p>
        <p className="mt-1 text-[10px] tracking-[0.16em] uppercase">{SECTORS.length} sectors</p>
        <p className="text-[10px] tracking-[0.16em] text-[#6d6860] uppercase">{LANDMASSES[0]?.regions.length ?? 0} regions</p>
        <p className="text-[10px] tracking-[0.16em] text-[#6d6860] uppercase">Continent</p>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.14em] text-[#6d6860] uppercase">
        <div className="mb-1 h-px w-16 bg-[#1c1c1c]" />
        1 square
      </div>
      {showHint ? (
        <div className="pointer-events-none absolute top-3 left-3 text-[10px] font-semibold tracking-[0.18em] text-[#6d6860] uppercase">
          Click a square
        </div>
      ) : null}

      <div className="absolute right-3 bottom-14 flex flex-col gap-1.5">
        <ChartButton label="Zoom in" onClick={() => zoomBy(1.25)}>
          +
        </ChartButton>
        <ChartButton label="Zoom out" onClick={() => zoomBy(0.8)}>
          −
        </ChartButton>
        <ChartButton
          label="Fit chart"
          onClick={() => {
            const next = fitCamera(size.w, size.h)
            fitK.current = next.k
            camRef.current = next
            setCam(next)
          }}
        >
          ⌂
        </ChartButton>
      </div>
      <svg viewBox="0 0 64 64" className="pointer-events-none absolute right-3 bottom-3 h-12 w-12 text-[#1c1c1c]" aria-hidden="true">
        <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M32 12 L35 32 L32 28 L29 32 Z" fill="currentColor" />
        <path d="M32 52 L29 32 L32 36 L35 32 Z" fill="none" stroke="currentColor" strokeWidth="1" />
        <text x="32" y="11" textAnchor="middle" fontSize="7" fontFamily="Outfit, sans-serif" fill="currentColor">
          N
        </text>
      </svg>

      {focus && showSectors ? (
        <aside
          className={`absolute z-10 w-56 border border-[#1c1c1c] bg-[#f7f4ee] p-2.5 text-[#1c1c1c] shadow-[0_10px_24px_rgba(0,0,0,0.16)] ${
            pinned ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          style={{ left: tip.x, top: tip.y }}
        >
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[#6d6860]">
            {focusPin?.isYou ? 'yours' : focusPin?.isNpc ? 'NPC crew' : focusPin ? 'Player' : 'Open sector'}
          </p>
          <p className="mt-1 font-display text-lg font-semibold uppercase">
            {focusPin?.name?.trim() || focus.regionName}
          </p>
          <p className="mt-1 text-[12px] text-[#3c3a36]">
            {focusPin && !focusPin.isYou
              ? `Held by ${focusPin.player?.username ?? focusPin.name ?? 'a crew'}`
              : focus.regionName}
          </p>
          {focusPin && card ? (
            <dl className="mt-2 space-y-1 border-t border-[#1c1c1c]/15 pt-2 text-[12px]">
              <Row label="Name" value={card.username} />
              <Row label="Title" value={card.title} />
              <Row label="Level" value={String(card.level)} />
              <Row label="Rank" value={card.rank ? `#${card.rank}` : '—'} />
              <Row label="Wealth" value={card.estimatedWealth} />
              <Row label="Weapons" value={String(card.weapons)} />
              <Row label="Properties" value={String(card.properties)} />
              <Row label="Heists" value={String(card.successfulHeists)} />
              {card.failedHeists !== undefined ? <Row label="Misses" value={String(card.failedHeists)} /> : null}
            </dl>
          ) : null}
          {pinned && focusPin && !focusPin.isYou ? (
            showHint ? (
              <p className="mt-2 bg-[#c8c3bb] px-2 py-2 text-center text-[11px] text-[#5c5852]">Finish account creation first.</p>
            ) : (
              <button
                type="button"
                className="gloss-gold mt-2 w-full cursor-pointer px-3 py-1.5 text-sm font-medium"
                onClick={() =>
                  navigate(
                    `/heists?player=${encodeURIComponent(focusPin.player.username)}&kind=${focusPin.isNpc ? 'npc' : 'player'}`,
                  )
                }
              >
                Prepare heist
              </button>
            )
          ) : null}
          {pinned && !focusPin && canClaim ? (
            <div className="mt-2 space-y-2">
              <label className="block text-[10px] tracking-[0.14em] text-[#6d6860] uppercase">
                Block name
                <input
                  className="mt-1 w-full border border-[#1c1c1c] bg-white px-2 py-1 text-sm text-[#1c1c1c]"
                  value={blockName}
                  maxLength={32}
                  placeholder="Name this block"
                  onChange={(event) => setBlockName(event.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy || blockName.trim().length < 1}
                className="gloss-gold w-full cursor-pointer px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                onClick={() => onClaim(focus, blockName.trim())}
              >
                {busy ? 'Filing…' : 'Claim sector'}
              </button>
            </div>
          ) : null}
          {pinned && !focusPin && !canClaim && claimHint ? (
            <p className="mt-2 text-[11px] text-[#6d6860]">{claimHint}</p>
          ) : null}
        </aside>
      ) : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[10px] tracking-[0.14em] text-[#8d877c] uppercase">{label}</dt>
      <dd className="truncate text-right">{value}</dd>
    </div>
  )
}

function ChartButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="h-8 w-8 cursor-pointer border border-[#1c1c1c] bg-[#f7f4ee] text-sm text-[#1c1c1c]"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function claimErrorCopy(err: unknown) {
  if (err instanceof ApiError && err.code === 'SECTOR_OCCUPIED') return 'That sector is already claimed.'
  if (err instanceof ApiError && err.code === 'ALREADY_HAS_BASE') return 'You already have a base on the chart.'
  if (err instanceof ApiError && isQuiet(err)) return 'The chart office has not opened claims.'
  return err instanceof ApiError ? err.message : 'The claim did not file.'
}

function isQuiet(err: ApiError) {
  return err.status === 404 || err.status === 501
}
