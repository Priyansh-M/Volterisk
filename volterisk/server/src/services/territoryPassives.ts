import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";

export type TerritoryPassives = {
  industrial: boolean;
  financial: boolean;
  industrialCount: number;
  financialCount: number;
  attackBuffPercent: number;
  /** Flat points subtracted from attackers when you hold industrial. */
  defenseFlat: number;
  /** Cap on attacker success % while defending with industrial (100 − defenseFlat). */
  maxSecuredPercent: number;
  workCooldownCutMinutes: number;
  collectBonusPercent: number;
};

function stackedBonus(count: number, base: number, extraPerStack: number): number {
  if (count <= 0) return 0;
  return base + (count - 1) * extraPerStack;
}

/** Account-wide buffs while the player owns specialized territory holdings. Same type stacks. */
export async function territoryPassives(userId: string): Promise<TerritoryPassives> {
  const holdings = await prisma.territoryHolding.findMany({
    where: { userId },
    select: { specialization: true },
  });
  const industrialCount = holdings.filter((h) => h.specialization === "industrial").length;
  const financialCount = holdings.filter((h) => h.specialization === "financial").length;
  const ind = RULES.TERRITORY.SPECIALIZATIONS.industrial;
  const fin = RULES.TERRITORY.SPECIALIZATIONS.financial;
  const attackBuffPercent = stackedBonus(
    industrialCount,
    ind.attackBuffPercent,
    ind.attackBuffExtraPerStack,
  );
  const defenseFlat = stackedBonus(industrialCount, ind.defenseFlat, ind.defenseExtraPerStack);
  return {
    industrial: industrialCount > 0,
    financial: financialCount > 0,
    industrialCount,
    financialCount,
    attackBuffPercent,
    defenseFlat,
    maxSecuredPercent: industrialCount > 0 ? Math.max(1, 100 - defenseFlat) : 100,
    workCooldownCutMinutes: stackedBonus(
      financialCount,
      fin.workCooldownCutMinutes,
      fin.workCooldownExtraPerStack,
    ),
    collectBonusPercent: stackedBonus(
      financialCount,
      fin.collectBonusPercent,
      fin.collectBonusExtraPerStack,
    ),
  };
}

export function applyHeistChance(
  baseChance: number,
  attacker: TerritoryPassives,
  defender: TerritoryPassives,
): number {
  let chance = baseChance + attacker.attackBuffPercent - defender.defenseFlat;
  if (defender.industrial) {
    chance = Math.min(chance, defender.maxSecuredPercent);
  }
  return Math.max(1, Math.min(99, Math.round(chance)));
}
