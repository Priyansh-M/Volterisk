import type { Profile } from './types.ts'

/** Pocket cash before L11. Vault/card balance from L11 on. */
export function spendable(me: Pick<Profile, 'cash' | 'vaultCreditCard' | 'vault' | 'level'> | null | undefined): number {
  if (!me) return 0
  if (me.vaultCreditCard || me.level >= 11) return me.vault.balance
  return me.cash
}
