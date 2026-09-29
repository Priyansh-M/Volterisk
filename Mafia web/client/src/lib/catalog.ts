/** Client-side shop copy. Prices match server RULES.WEAPON_BUY_COSTS. */
export const WEAPON_CATALOG = [
  {
    id: 'weapon:0001',
    number: 1,
    name: 'Rusty Crowbar',
    type: 'Breaching Tool',
    price: 0,
    attacks: [10, 13, 16, 19],
    flavor: 'Starter weapon. Cheap and reliable, relatively weak.',
  },
  {
    id: 'weapon:0002',
    number: 2,
    name: 'Lockpick Set',
    type: 'Infiltration Tool',
    price: 12_000,
    attacks: [19, 23, 27, 31],
    flavor: 'Steadier against low and medium security vaults.',
  },
  {
    id: 'weapon:0003',
    number: 3,
    name: 'Advanced Drill',
    type: 'Mechanical Breach',
    price: 40_000,
    attacks: [31, 36, 41, 46],
    flavor: 'High attack, and loud enough that the street notices.',
  },
  {
    id: 'weapon:0004',
    number: 4,
    name: 'Thermal Cutter',
    type: 'High-Power Breach',
    price: 125_000,
    attacks: [46, 52, 58, 64],
    flavor: 'Cuts reinforced vaults that shrug off drills.',
  },
  {
    id: 'weapon:0005',
    number: 5,
    name: 'Vault Breaker',
    type: 'Heavy Breaching System',
    price: 350_000,
    attacks: [64, 72, 80, 88],
    flavor: 'Built for high-security and rare vaults.',
  },
] as const

export type CatalogWeapon = (typeof WEAPON_CATALOG)[number]
