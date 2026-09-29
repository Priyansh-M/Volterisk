import { GameError } from "../game/errors.js";
import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { creditCash, type Tx } from "./economyService.js";

export const STARTER_GRANT_TYPE = "starter_grant";

export type OnboardingState = {
  needsIntro: boolean;
  hasClaimedStarter: boolean;
  hasBase: boolean;
};

/** "weapon:0001" reads as "WEAPON 0001" on the intro card. */
export function weaponLabel(weaponId: string): string {
  return weaponId.replace(":", " ").toUpperCase();
}

export function onboardingStateFrom(user: {
  starterClaimedAt: Date | null;
  base: unknown | null;
}): OnboardingState {
  const hasClaimedStarter = Boolean(user.starterClaimedAt);
  const hasBase = Boolean(user.base);
  return {
    needsIntro: !hasClaimedStarter || !hasBase,
    hasClaimedStarter,
    hasBase,
  };
}

/** Records the signup grant so the claim endpoint can never pay it twice. */
export async function recordStarterGrant(tx: Tx, userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await tx.transaction.create({
    data: { type: STARTER_GRANT_TYPE, amount, toUserId: userId },
  });
}

/**
 * Idempotent. The first call hands over the starter kit; later calls report the
 * same kit back without moving money again.
 */
export async function claimStarter(userId: string) {
  const starter = RULES.WEAPONS[0];

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");

    const alreadyGranted = await tx.transaction.findFirst({
      where: { type: STARTER_GRANT_TYPE, toUserId: userId },
    });
    if (!alreadyGranted) {
      await creditCash(tx, userId, RULES.STARTING_CASH);
      await recordStarterGrant(tx, userId, RULES.STARTING_CASH);
    }

    let owned = await tx.userWeapon.findFirst({
      where: { userId, weaponId: starter.id },
    });
    if (!owned) {
      const equippedCount = await tx.userWeapon.count({ where: { userId, equipped: true } });
      owned = await tx.userWeapon.create({
        data: {
          userId,
          weaponId: starter.id,
          upgradeLevel: RULES.WEAPON_MIN_UPGRADE,
          equipped: equippedCount === 0,
        },
      });
    }

    if (!user.starterClaimedAt) {
      await tx.user.update({ where: { id: userId }, data: { starterClaimedAt: new Date() } });
    }

    const fresh = await tx.user.findUnique({ where: { id: userId } });
    return {
      cash: fresh?.cash ?? user.cash,
      items: [
        {
          id: starter.id,
          name: starter.name,
          label: weaponLabel(starter.id),
          level: owned.upgradeLevel,
        },
      ],
    };
  });
}
