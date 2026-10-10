/**
 * Deterministic order for heist inputs:
 * 1) base attack / defence
 * 2) career attack
 * 3) weapon mod flat / conditional attack
 * 4) vault mod flat defence
 * 5) conditional vault defence (advantage-aware, using attack after weapon flats)
 * 6) predictive matrix advantage trim
 * 7) base successChance(attack, defense, camera)
 * 8) chance point mods + career + territory
 * clamp stays inside successChance / applyHeistChance.
 */
import {
  WEAPON_REPAIR_FULL_COST,
  type VaultModDef,
  type WeaponModDef,
  vaultModById,
  weaponModById,
} from "../game/careersAndMods.js";
import { successChance } from "../game/probability.js";
import { vaultSecuredPercent } from "../game/rules.js";

export type CombatResolveInput = {
  baseAttack: number;
  baseDefense: number;
  camera: number;
  vaultTier: string;
  vaultLevel: number;
  vaultBalance: number;
  vaultCapacity: number;
  weaponModIds: string[];
  vaultModIds: string[];
  /** Emergency lockdown armed for this attack. */
  lockdownActive?: boolean;
  careerAttackFlat?: number;
  careerChanceFlat?: number;
  territoryChanceFlat?: number;
};

export type CombatResolveResult = {
  attack: number;
  defense: number;
  chance: number;
  rewardMult: number;
  lossMult: number;
  durabilityLoss: number;
  specialAttackCut: boolean;
};

function weaponDefs(ids: string[]): WeaponModDef[] {
  return ids.map(weaponModById).filter((m): m is WeaponModDef => Boolean(m));
}

function vaultDefs(ids: string[]): VaultModDef[] {
  return ids.map(vaultModById).filter((m): m is VaultModDef => Boolean(m));
}

export function resolveCombat(input: CombatResolveInput): CombatResolveResult {
  const wMods = weaponDefs(input.weaponModIds);
  const vMods = vaultDefs(input.vaultModIds);
  const reinforced = input.vaultTier === "gold" || input.vaultTier === "diamond";
  const specialCut = vMods.some((m) => m.cutSpecialAttackBonusHalf);

  let attack = input.baseAttack + (input.careerAttackFlat ?? 0);
  for (const m of wMods) {
    if (m.attackFlat) attack += m.attackFlat;
  }
  for (const m of wMods) {
    if (m.attackVsReinforced != null || m.attackVsLowerSecurity != null) {
      let bonus = reinforced ? (m.attackVsReinforced ?? 0) : (m.attackVsLowerSecurity ?? 0);
      if (specialCut && bonus > 0) bonus = Math.floor(bonus * 0.5);
      attack += bonus;
    }
    if (m.attackVsDefenseMin && input.baseDefense >= m.attackVsDefenseMin.minDefense) {
      let bonus = m.attackVsDefenseMin.attackFlat;
      if (specialCut && bonus > 0) bonus = Math.floor(bonus * 0.5);
      attack += bonus;
    }
    if (m.adaptiveLock) {
      const gap = input.baseDefense - attack;
      if (gap > m.adaptiveLock.within) attack += m.adaptiveLock.attackFlatWhenHigher;
    }
  }

  let defense = input.baseDefense;
  for (const m of vMods) {
    if (m.defenseFlat) defense += m.defenseFlat;
  }

  let advantage = attack - defense;
  for (const m of vMods) {
    if (m.defenseWhenAdvantageAtMost && advantage <= m.defenseWhenAdvantageAtMost.advantage) {
      defense += m.defenseWhenAdvantageAtMost.defenseFlat;
    }
    if (m.defenseWhenAttackNotAbove && attack <= defense) {
      defense += m.defenseWhenAttackNotAbove;
    }
    if (m.defenseWhenAdvantageOver && advantage > m.defenseWhenAdvantageOver.advantage) {
      defense += m.defenseWhenAdvantageOver.defenseFlat;
    }
    if (m.emergencyLockdown && input.lockdownActive) {
      defense += m.emergencyLockdown.defenseFlat;
    }
    if (m.defenseWhenSecuredPercentAtLeast) {
      const need = m.defenseWhenSecuredPercentAtLeast;
      const tierOk =
        need.minTier === "diamond"
          ? input.vaultTier === "diamond"
          : input.vaultTier === "gold" || input.vaultTier === "diamond";
      const secured = vaultSecuredPercent(input.vaultTier, input.vaultLevel);
      if (tierOk && secured >= need.percent) defense += need.defenseFlat;
    }
  }

  advantage = attack - defense;
  for (const m of vMods) {
    if (m.reduceAdvantageBy && advantage > 0) {
      const trimmed = Math.max(0, advantage - m.reduceAdvantageBy);
      defense = attack - trimmed;
      advantage = trimmed;
    }
  }

  let chance = successChance(attack, defense, input.camera);
  for (const m of wMods) {
    if (m.chanceWhenWithin) {
      const diff = Math.abs(attack - defense);
      const adv = attack - defense;
      if (m.noBonusWhenAdvantageOver != null && adv > m.noBonusWhenAdvantageOver) {
        /* skip */
      } else if (diff <= m.chanceWhenWithin.window) {
        chance += m.chanceWhenWithin.points;
      }
    }
    if (m.adaptiveLock) {
      const gap = defense - attack;
      if (gap <= m.adaptiveLock.within && gap >= 0) chance += m.adaptiveLock.chancePoints;
    }
  }
  chance += input.careerChanceFlat ?? 0;
  chance += input.territoryChanceFlat ?? 0;
  chance = Math.min(92, Math.max(8, chance));

  let rewardMult = 1;
  let lossMult = 1;
  for (const m of wMods) {
    if (m.rewardMult) rewardMult *= m.rewardMult;
  }
  for (const m of vMods) {
    if (m.heistRewardMultOnSuccess) rewardMult *= m.heistRewardMultOnSuccess;
    if (m.lossReductionMult) lossMult *= m.lossReductionMult;
  }

  let durabilityLoss = 1;
  let lossMultDur = 1;
  let extra = 0;
  for (const m of wMods) {
    if (m.durabilityLossMult != null) lossMultDur *= m.durabilityLossMult;
    if (m.extraDurabilityLoss) extra += m.extraDurabilityLoss;
  }
  durabilityLoss = Math.max(1, Math.ceil(durabilityLoss * lossMultDur) + extra);

  return {
    attack,
    defense,
    chance,
    rewardMult,
    lossMult,
    durabilityLoss,
    specialAttackCut: specialCut,
  };
}

export function repairReferenceCost(weaponId: string, modIds: string[]): number {
  let base = WEAPON_REPAIR_FULL_COST[weaponId] ?? 1_000;
  for (const id of modIds) {
    const m = weaponModById(id);
    if (m?.repairCostMult) base *= m.repairCostMult;
  }
  return Math.ceil(base);
}

export function repairCostForWeapon(
  weaponId: string,
  current: number,
  max: number,
  modIds: string[],
): number {
  if (max <= 0 || current >= max) return 0;
  if (current <= 0) return 0;
  const full = repairReferenceCost(weaponId, modIds);
  return Math.ceil((full * (max - current)) / max);
}
