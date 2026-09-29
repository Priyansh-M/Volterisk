export type Profile = {
  id: string
  username: string
  level: number
  cash: number
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
  id: string
  name: string
  number: number
  upgradeLevel: number
  effectiveLevel: number
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
  vulnerable: boolean
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
  richest: { rank: number; username: string; netWorth: number }[]
  heisters: { rank: number; username: string; successfulHeists: number }[]
  largestHeists: {
    rank: number
    attackerUsername: string
    targetUsername: string
    amount: number
    createdAt: string
  }[]
}

export type VaultView = {
  balance: number
  level: number
  maxLevel: number
  upgradeCost: number | null
}
