export type Pt = [number, number]

export type RegionSeed = { name: string; x: number; y: number }

export type Landmass = {
  id: string
  name: string
  /** Grid step in world units. Every cell whose center sits on land is a sector. */
  step: number
  polygon: Pt[]
  regions: RegionSeed[]
  borders: Pt[][]
  label: Pt
}

/** Paper chart bounds — Volterisk plate plus the eastern Skarn landmass. */
export const WORLD = { width: 1120, height: 760 }

const velmora: Landmass = {
  id: 'velmora',
  name: 'Volterisk',
  step: 22,
  label: [300, 340],
  polygon: [
    [259, 53],
    [248, 65],
    [264, 68],
    [266, 83],
    [248, 104],
    [177, 107],
    [157, 155],
    [68, 167],
    [62, 182],
    [95, 194],
    [100, 218],
    [178, 236],
    [186, 245],
    [142, 254],
    [83, 266],
    [94, 311],
    [85, 329],
    [116, 347],
    [110, 377],
    [119, 386],
    [201, 407],
    [187, 443],
    [204, 446],
    [198, 470],
    [219, 491],
    [226, 530],
    [302, 542],
    [286, 563],
    [305, 578],
    [290, 599],
    [306, 614],
    [301, 638],
    [330, 648],
    [347, 653],
    [362, 638],
    [350, 623],
    [369, 614],
    [388, 590],
    [391, 551],
    [386, 533],
    [371, 509],
    [393, 485],
    [396, 467],
    [387, 455],
    [362, 449],
    [372, 431],
    [343, 425],
    [347, 410],
    [333, 383],
    [353, 371],
    [346, 347],
    [385, 344],
    [394, 323],
    [437, 284],
    [441, 230],
    [426, 221],
    [417, 185],
    [405, 158],
    [382, 155],
    [384, 137],
    [336, 122],
    [308, 92],
    [284, 86],
    [267, 53],
  ],
  regions: [
    { name: 'North Horn', x: 310, y: 130 },
    { name: 'West Reach', x: 120, y: 200 },
    { name: 'Inner Shelf', x: 250, y: 330 },
    { name: 'East Bight', x: 390, y: 270 },
    { name: 'South Keys', x: 340, y: 560 },
  ],
  borders: [],
}

/**
 * Second continent — outline traced from the eastern plate art, placed ~5cm
 * (≈190 world units) east of Volterisk. Same sector grid; no painted region labels.
 */
const skarn: Landmass = {
  id: 'skarn',
  name: 'Skarn',
  step: 22,
  label: [830, 340],
  polygon: [
    [723, 40],
    [714, 52],
    [699, 64],
    [687, 76],
    [672, 87],
    [661, 99],
    [658, 111],
    [658, 123],
    [658, 135],
    [658, 147],
    [658, 158],
    [658, 170],
    [658, 182],
    [658, 194],
    [655, 206],
    [655, 218],
    [658, 229],
    [661, 241],
    [664, 253],
    [667, 265],
    [669, 277],
    [669, 289],
    [672, 300],
    [664, 312],
    [655, 324],
    [649, 336],
    [640, 348],
    [631, 360],
    [634, 371],
    [640, 383],
    [646, 395],
    [652, 407],
    [658, 419],
    [664, 431],
    [664, 442],
    [661, 454],
    [658, 466],
    [652, 478],
    [646, 490],
    [643, 502],
    [640, 513],
    [643, 525],
    [649, 537],
    [655, 549],
    [661, 561],
    [667, 573],
    [672, 584],
    [678, 596],
    [735, 608],
    [803, 620],
    [853, 620],
    [888, 608],
    [915, 596],
    [918, 584],
    [921, 573],
    [924, 561],
    [927, 549],
    [930, 537],
    [936, 525],
    [939, 513],
    [942, 502],
    [962, 490],
    [989, 478],
    [1007, 466],
    [1007, 454],
    [1007, 442],
    [1007, 431],
    [1004, 419],
    [1004, 407],
    [1001, 395],
    [1001, 383],
    [1001, 371],
    [1004, 360],
    [1010, 348],
    [1016, 336],
    [1022, 324],
    [1030, 312],
    [1030, 300],
    [1025, 289],
    [1019, 277],
    [1013, 265],
    [1007, 253],
    [1001, 241],
    [1001, 229],
    [1004, 218],
    [1007, 206],
    [1010, 194],
    [1016, 182],
    [1019, 170],
    [1022, 158],
    [1019, 147],
    [1004, 135],
    [989, 123],
    [974, 111],
    [951, 99],
    [915, 87],
    [880, 76],
    [850, 64],
    [823, 52],
    [800, 40],
  ],
  regions: [
    { name: 'North Spur', x: 780, y: 120 },
    { name: 'West Shelf', x: 700, y: 300 },
    { name: 'East Reach', x: 960, y: 280 },
    { name: 'South Bank', x: 820, y: 540 },
  ],
  borders: [],
}

export const LANDMASSES: Landmass[] = [velmora, skarn]

/** Nothing sits outside the Volterisk outline. */
export const ISLANDS: Pt[][] = []

export const SEA_LABELS: { name: string; at: Pt }[] = []

/**
 * Five points on Volterisk. Night-crew stations use the sectors these resolve to.
 * The server stores the same sector ids so the squares stay occupied.
 */
export const NPC_STATION_MARKS = [
  { username: 'Mara Voss', x: 275, y: 77 },
  { username: 'Eddie Quill', x: 187, y: 121 },
  { username: 'Nia Pell', x: 319, y: 143 },
  { username: 'Hugo Brandt', x: 99, y: 165 },
  { username: 'Colette Marsh', x: 407, y: 165 },
  { username: 'Felix Dunn', x: 231, y: 187 },
  { username: 'Ruth Keene', x: 165, y: 231 },
  { username: 'Samir Odeh', x: 297, y: 231 },
  { username: 'Inez Calder', x: 385, y: 253 },
  { username: 'Paulie Tran', x: 99, y: 275 },
  { username: 'Wes Harlow', x: 231, y: 275 },
  { username: 'Lila Quinn', x: 165, y: 319 },
  { username: 'Otto Venn', x: 297, y: 319 },
  { username: 'Sera Lang', x: 385, y: 341 },
  { username: 'Mick Doyle', x: 231, y: 363 },
  { username: 'Anya Frost', x: 121, y: 385 },
  { username: 'Jules Peck', x: 297, y: 407 },
  { username: 'Nora Kim', x: 209, y: 451 },
  { username: 'Theo Marsh', x: 363, y: 451 },
  { username: 'Cora Bennett', x: 275, y: 495 },
] as const

export type Sector = {
  id: string
  landmassId: string
  landmassName: string
  regionName: string
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
}

export function pointInPoly(x: number, y: number, poly: Pt[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0]
    const yi = poly[i][1]
    const xj = poly[j][0]
    const yj = poly[j][1]
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function bbox(poly: Pt[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of poly) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY }
}

function regionName(landmass: Landmass, x: number, y: number) {
  let best = landmass.regions[0]
  let bestD = Infinity
  for (const region of landmass.regions) {
    const d = (region.x - x) ** 2 + (region.y - y) ** 2
    if (d < bestD) {
      best = region
      bestD = d
    }
  }
  return best?.name ?? landmass.name
}

function sectorsFor(landmass: Landmass): Sector[] {
  const box = bbox(landmass.polygon)
  const step = landmass.step
  const x0 = Math.floor(box.minX / step) * step
  const y0 = Math.floor(box.minY / step) * step
  const cells: { x: number; y: number }[] = []
  for (let y = y0; y < box.maxY; y += step) {
    for (let x = x0; x < box.maxX; x += step) {
      const cx = x + step / 2
      const cy = y + step / 2
      if (pointInPoly(cx, cy, landmass.polygon)) cells.push({ x, y })
    }
  }
  return cells.map((cell, index) => {
    const cx = cell.x + step / 2
    const cy = cell.y + step / 2
    return {
      id: `${landmass.id}-${String(index + 1).padStart(4, '0')}`,
      landmassId: landmass.id,
      landmassName: landmass.name,
      regionName: regionName(landmass, cx, cy),
      x: cell.x,
      y: cell.y,
      w: step,
      h: step,
      cx,
      cy,
    }
  })
}

export const SECTORS: Sector[] = LANDMASSES.flatMap(sectorsFor)

export const sectorById = new Map(SECTORS.map((sector) => [sector.id, sector]))

const byLandmass = new Map<string, Sector[]>()
for (const sector of SECTORS) {
  const list = byLandmass.get(sector.landmassId)
  if (list) list.push(sector)
  else byLandmass.set(sector.landmassId, [sector])
}

export function sectorsInView(
  landmassId: string,
  view: { x: number; y: number; w: number; h: number },
) {
  const list = byLandmass.get(landmassId) ?? []
  const x2 = view.x + view.w
  const y2 = view.y + view.h
  return list.filter((sector) => sector.x < x2 && sector.x + sector.w > view.x && sector.y < y2 && sector.y + sector.h > view.y)
}

export function sectorAt(x: number, y: number): Sector | null {
  for (const landmass of LANDMASSES) {
    const box = bbox(landmass.polygon)
    if (x < box.minX || x > box.maxX || y < box.minY || y > box.maxY) continue
    if (!pointInPoly(x, y, landmass.polygon)) continue
    const step = landmass.step
    const sx = Math.floor(x / step) * step
    const sy = Math.floor(y / step) * step
    const list = byLandmass.get(landmass.id) ?? []
    return list.find((sector) => sector.x === sx && sector.y === sy) ?? null
  }
  return null
}

export function stationSectors() {
  return NPC_STATION_MARKS.map((mark) => {
    const sector = sectorAt(mark.x, mark.y)
    return {
      username: mark.username,
      sectorId: sector?.id ?? null,
      landmassId: sector?.landmassId ?? null,
      regionName: sector?.regionName ?? null,
    }
  })
}

export function toPath(points: Pt[]) {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`
}

export function openPath(points: Pt[]) {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')}`
}

export function sectorCounts() {
  return LANDMASSES.map((landmass) => ({
    id: landmass.id,
    count: SECTORS.filter((sector) => sector.landmassId === landmass.id).length,
  }))
}
