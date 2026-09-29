/** Client-side shop copy. Prices match server RULES.WEAPON_BUY_COSTS. */
export const WEAPON_CATALOG = [
  {
    id: 'weapon:0001',
    number: 1,
    name: 'Rusty Crowbar',
    price: 0,
    flavor: 'Issued with the kit. The first tool you trust when the lock is older than the door.',
  },
  {
    id: 'weapon:0002',
    number: 2,
    name: 'Gun',
    price: 20_000,
    flavor: 'A short argument. Loud, and the vault knows you brought it.',
  },
  {
    id: 'weapon:0003',
    number: 3,
    name: 'Drill',
    price: 40_000,
    flavor: 'A patient machine that does not care who owns the plate.',
  },
  {
    id: 'weapon:0004',
    number: 4,
    name: 'Lockpick Set',
    price: 60_000,
    flavor: 'Quiet steel and practiced hands. A conversation with tumblers.',
  },
  {
    id: 'weapon:0005',
    number: 5,
    name: 'Thermal Cutter',
    price: 80_000,
    flavor: 'A seam of light where the vault thought it was whole.',
  },
] as const

export type CatalogWeapon = (typeof WEAPON_CATALOG)[number]
