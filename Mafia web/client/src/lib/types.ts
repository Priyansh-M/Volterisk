export type Onboarding = {
  needsIntro: boolean
  hasClaimedStarter: boolean
  hasBase: boolean
}

export type PlayerBase = {
  sectorId: string
  landmassId: string
  regionName: string
}

export type Profile = {
  id: string
  username: string
  level: number
  title: string
  rank: number
  cash: number
  onboarding: Onboarding
  base: PlayerBase | null
  vault: { balance: number; level: number }
  equippedWeapon: {
    id: string
    name: string
    number: number
    upgradeLevel: number
    effectiveLevel: number
  } | null
  cooldownEndsAt: string | null
  stats: {
    successfulHeists: number
    failedHeists: number
    totalStolen: number
    totalLost: number
  }
}

export type OwnedWeapon = {
  instanceId?: string
  id: string
  name: string
  number: number
  type?: string
  upgradeLevel: number
  attack?: number
  nextAttack?: number | null
  effectiveLevel: number
  nextEffectiveLevel: number | null
  durability?: number
  maxDurability?: number
  equipped: boolean
  nextUpgradeCost: number | null
}

export type ShopWeapon = {
  id: string
  name: string
  number: number
  price: number | null
  effectiveLevel: number
}

export type Target = {
  userId: string
  username: string
  vaultLevel: number
  wealthBucket: 'modest' | 'heavy' | 'fortune'
  estimatedWealth?: string
  vulnerable: boolean
  sectorId?: string | null
  regionName?: string | null
  cadence?: 'day' | 'week' | null
}

/** `player` is the heist kind. The targets payload names that list `players`. */
export type HeistKind = 'npc' | 'player'

export type TargetBoard = {
  npc: Target[]
  players: Target[]
}

export type HeistResult = {
  id: string
  success: boolean
  amountStolen: number
  targetUsername: string
  weaponName: string
  weaponLevel: number
  vaultLevel: number
  successChance: number
  cooldownEndsAt: string
  broken?: boolean
  attack?: number
  defense?: number
  advantage?: number
}

export type HistoryRow = {
  id: string
  role: 'attacker' | 'target'
  success: boolean
  amountStolen: number
  otherUsername: string
  weaponName: string
  createdAt: string
}

export type Leaderboard = {
  richest: { rank: number; username: string; netWorth: number; level?: number; successfulHeists?: number; base?: string | null }[]
  heisters: { rank: number; username: string; successfulHeists: number }[]
  largestHeists: {
    rank: number
    attackerUsername: string
    targetUsername: string
    amount: number
    createdAt: string
  }[]
}

export type PublicCard = {
  username: string
  title: string
  level: number
  rank: number
  estimatedWealth: string
  properties: number
  weapons: number
  successfulHeists: number
  failedHeists?: number
  base?: PlayerBase | null
}

export type MapPin = {
  sectorId: string
  landmassId: string
  regionName: string
  isYou: boolean
  isNpc?: boolean
  player: PublicCard
}

export type WorkOffer = {
  id: string
  name: string
  minLevel: number
  durationMinutes: number
  reward: number
  risk: string
  locationLabel: string
  requirement: string
  difficulty?: string
  requiresProperty?: string | null
  locked: boolean
  available: boolean
  cooldownEndsAt: string | null
}

export type ActiveContract = {
  id: string
  contractId: string
  name: string
  reward: number
  risk: string
  locationLabel: string
  acceptedAt: string
  completesAt: string
  ready: boolean
}

export type WorkBoard = {
  active: ActiveContract | null
  contracts: WorkOffer[]
}

export type StarterClaim = {
  cash: number
  items: { id: string; name: string; label: string; level: number }[]
}

export type GameNotice = {
  id: string
  title: string
  body: string
  read?: boolean
  severity?: string
  createdAt: string
}

export type VaultView = {
  balance: number
  level: number
  tier?: string
  tierLabel?: string
  defense?: number
  capacity?: number
  securedPercent?: number
  exposed?: number
  secured?: number
  insured?: boolean
  maxLevel: number
  upgradeCost: number | null
  next?: {
    tier: string
    tierLabel: string
    level: number
    defense: number
    capacity: number
    converts: boolean
  } | null
}
