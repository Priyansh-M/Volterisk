/** Reputation levels that grant weapon mod slots (1 → 2 → 3). */
export const WEAPON_SLOT_UNLOCK_LEVELS = [15, 25, 35] as const

/** Reputation levels that grant vault mod slots (1 → 2 → 3 → 4). */
export const VAULT_SLOT_UNLOCK_LEVELS = [15, 20, 25, 35] as const

export function nextModSlotUnlockLevel(kind: 'weapon' | 'vault', reputationLevel: number): number | null {
  const ladder = kind === 'weapon' ? WEAPON_SLOT_UNLOCK_LEVELS : VAULT_SLOT_UNLOCK_LEVELS
  return ladder.find((level) => level > reputationLevel) ?? null
}

/** Short hint for UI copy about modification slots. */
export function modSlotUnlockHint(kind: 'weapon' | 'vault', reputationLevel: number): string {
  if (reputationLevel < 15) return 'first slot unlocks at Reputation level 15'
  const next = nextModSlotUnlockLevel(kind, reputationLevel)
  if (next == null) return 'all modification slots unlocked'
  return `next slot unlocks at Reputation level ${next}`
}
