export type Pt = [number, number]

export type RegionSeed = { name: string; x: number; y: number }

export type Landmass = {
  id: string
  name: string
  /** Grid step in world units. Tuned so each coast holds about 500 sectors. */
  step: number
  polygon: Pt[]
  regions: RegionSeed[]
  borders: Pt[][]
  label: Pt
}

export const WORLD = { width: 2000, height: 1160 }

const ashmere: Landmass = {
  id: 'ashmere',
  name: 'Ashmere',
  step: 26,
  label: [360, 430],
  polygon: [
    [118, 248], [150, 188], [196, 142], [250, 118], [312, 96], [368, 128], [402, 92], [468, 118],
    [522, 96], [578, 138], [630, 188], [668, 246], [692, 312], [664, 368], [706, 424], [678, 488],
    [712, 552], [674, 616], [620, 668], [552, 704], [478, 736], [402, 754], [328, 728], [262, 756],
    [198, 712], [146, 652], [108, 586], [86, 514], [78, 442], [96, 368], [84, 304],
  ],
  regions: [
    { name: 'Grey Marches', x: 230, y: 210 },
    { name: 'Salt Mere', x: 500, y: 210 },
    { name: 'Harrow Coast', x: 190, y: 470 },
    { name: 'Low Vellum', x: 500, y: 500 },
    { name: 'Crow Fen', x: 340, y: 680 },
  ],
  borders: [
    [[140, 330], [280, 300], [430, 340], [560, 300], [670, 360]],
    [[300, 140], [270, 280], [240, 430], [210, 580], [250, 720]],
    [[430, 360], [480, 500], [520, 640], [470, 730]],
  ],
}

const calderune: Landmass = {
  id: 'calderune',
  name: 'Calderune',
  step: 26,
  label: [1340, 330],
  polygon: [
    [969, 215], [1030, 137], [1113, 83], [1206, 64], [1306, 95], [1396, 66], [1486, 108], [1577, 81],
    [1665, 137], [1730, 205], [1762, 288], [1723, 364], [1769, 442], [1701, 515], [1608, 559],
    [1504, 532], [1401, 588], [1294, 547], [1194, 600], [1098, 554], [1018, 486], [962, 405],
    [933, 325], [950, 264],
  ],
  regions: [
    { name: 'North Spit', x: 1180, y: 180 },
    { name: 'Cinder Shelf', x: 1560, y: 190 },
    { name: 'Lantern Reach', x: 1220, y: 430 },
    { name: 'Pale Hook', x: 1560, y: 440 },
  ],
  borders: [
    [[980, 300], [1140, 270], [1320, 310], [1500, 260], [1680, 320]],
    [[1280, 90], [1240, 220], [1220, 360], [1260, 500], [1320, 580]],
  ],
}

const brineholt: Landmass = {
  id: 'brineholt',
  name: 'Brineholt',
  step: 26,
  label: [1360, 860],
  polygon: [
    [890, 794], [977, 725], [1078, 680], [1192, 712], [1299, 653], [1413, 695], [1530, 638],
    [1646, 680], [1763, 646], [1864, 712], [1909, 799], [1869, 886], [1790, 956], [1676, 1013],
    [1547, 1060], [1413, 1030], [1279, 1077], [1145, 1035], [1026, 1092], [922, 1013], [843, 928],
    [823, 849],
  ],
  regions: [
    { name: 'Silt Keys', x: 1040, y: 820 },
    { name: 'Amber Bight', x: 1420, y: 780 },
    { name: 'Moth Harbor', x: 1680, y: 880 },
    { name: 'Quiet Shoal', x: 1180, y: 1000 },
  ],
  borders: [
    [[860, 900], [1040, 860], [1240, 910], [1460, 850], [1680, 900], [1840, 860]],
    [[1240, 700], [1200, 840], [1180, 960], [1240, 1060]],
    [[1500, 680], [1540, 820], [1580, 960], [1520, 1050]],
  ],
}

export const LANDMASSES: Landmass[] = [ashmere, calderune, brineholt]

/** Decorative islands. They are not claimable sectors. */
export const ISLANDS: Pt[][] = [
  [[46, 430], [78, 396], [118, 412], [108, 456], [64, 470]],
  [[760, 168], [804, 140], [846, 166], [828, 208], [774, 204]],
  [[790, 250], [824, 232], [858, 258], [830, 286], [792, 274]],
  [[620, 860], [668, 832], [708, 868], [674, 910], [622, 896]],
  [[1848, 150], [1892, 128], [1930, 162], [1896, 198], [1852, 186]],
  [[1704, 1108], [1752, 1084], [1790, 1120], [1740, 1146], [1696, 1128]],
  [[520, 140], [552, 122], [578, 146], [548, 168]],
]

export const SEA_LABELS: { name: string; at: Pt }[] = [
  { name: 'The Vesper Sea', at: [800, 460] },
  { name: 'Cinder Gulf', at: [820, 240] },
  { name: 'South Roads', at: [480, 980] },
]

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
