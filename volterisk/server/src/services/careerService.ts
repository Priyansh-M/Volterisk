import { CAREERS, CAREER_IDS, type CareerId, isCareerId } from "../game/careersAndMods.js";
import { GameError } from "../game/errors.js";
import { prisma } from "../prisma.js";
import { chargeSpend } from "./economyService.js";
import { writeNotification } from "./notificationService.js";

function presentCareer(id: CareerId | null) {
  if (!id) return null;
  const row = CAREERS.BONUSES[id];
  return { id, label: row.label, blurb: row.blurb };
}

export async function getCareer(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      primaryCareer: true,
      secondaryCareer: true,
      careerChangedAt: true,
      reputationLevel: true,
      cash: true,
    },
  });
  if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
  const primary = isCareerId(user.primaryCareer) ? user.primaryCareer : null;
  const secondary = isCareerId(user.secondaryCareer) ? user.secondaryCareer : null;
  const changedAt = user.careerChangedAt?.getTime() ?? 0;
  const cooldownEnds = primary && changedAt ? changedAt + CAREERS.SWITCH_PRIMARY_COOLDOWN_MS : 0;
  const cooldownMs = Math.max(0, cooldownEnds - Date.now());
  return {
    primary: presentCareer(primary),
    secondary: presentCareer(secondary),
    secondaryUnlocked: user.reputationLevel >= CAREERS.SECONDARY_UNLOCK_LEVEL,
    secondaryUnlockLevel: CAREERS.SECONDARY_UNLOCK_LEVEL,
    switchPrimaryFee: CAREERS.SWITCH_PRIMARY_FEE,
    switchSecondaryFee: CAREERS.SWITCH_SECONDARY_FEE,
    cooldownMs,
    canSwitchPrimary: !primary || cooldownMs <= 0,
    firstPickFree: !primary,
    cash: user.cash,
    options: CAREER_IDS.map((id) => presentCareer(id)!),
  };
}

export async function setPrimaryCareer(userId: string, careerId: string) {
  if (!isCareerId(careerId)) throw new GameError(400, "BAD_CAREER", "Unknown career.");
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { primaryCareer: true, secondaryCareer: true, careerChangedAt: true, cash: true },
    });
    if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
    const current = isCareerId(user.primaryCareer) ? user.primaryCareer : null;
    if (current === careerId) throw new GameError(400, "SAME_CAREER", "That is already your primary career.");
    if (user.secondaryCareer === careerId) {
      throw new GameError(400, "CAREER_CONFLICT", "Secondary already uses that identity. Clear or change secondary first.");
    }
    const first = !current;
    if (!first) {
      const ends = (user.careerChangedAt?.getTime() ?? 0) + CAREERS.SWITCH_PRIMARY_COOLDOWN_MS;
      if (Date.now() < ends) {
        throw new GameError(400, "CAREER_COOLDOWN", "Primary career is still on cooldown.");
      }
      if (user.cash < CAREERS.SWITCH_PRIMARY_FEE) {
        throw new GameError(400, "INSUFFICIENT_FUNDS", "Not enough cash to switch primary career.");
      }
      await chargeSpend(tx, userId, CAREERS.SWITCH_PRIMARY_FEE);
      await tx.transaction.create({
        data: { type: "career_switch_primary", amount: CAREERS.SWITCH_PRIMARY_FEE, fromUserId: userId },
      });
    }
    await tx.user.update({
      where: { id: userId },
      data: { primaryCareer: careerId, careerChangedAt: new Date() },
    });
    await writeNotification(tx, {
      userId,
      title: `Career · ${CAREERS.BONUSES[careerId].label}`,
      body: first
        ? `Primary career set. ${CAREERS.BONUSES[careerId].blurb}`
        : `Primary career switched for $${CAREERS.SWITCH_PRIMARY_FEE.toLocaleString("en-US")}. ${CAREERS.BONUSES[careerId].blurb}`,
      severity: "INFO",
    });
  }).then(() => getCareer(userId));
}

export async function setSecondaryCareer(userId: string, careerId: string | null) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { primaryCareer: true, secondaryCareer: true, reputationLevel: true, cash: true },
    });
    if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
    if (user.reputationLevel < CAREERS.SECONDARY_UNLOCK_LEVEL) {
      throw new GameError(403, "LEVEL_LOCKED", `Secondary specialisation unlocks at level ${CAREERS.SECONDARY_UNLOCK_LEVEL}.`);
    }
    if (careerId != null && !isCareerId(careerId)) {
      throw new GameError(400, "BAD_CAREER", "Unknown career.");
    }
    if (careerId && careerId === user.primaryCareer) {
      throw new GameError(400, "CAREER_CONFLICT", "Secondary cannot match primary.");
    }
    const had = Boolean(user.secondaryCareer);
    if (careerId && (had || user.secondaryCareer !== careerId)) {
      if (user.cash < CAREERS.SWITCH_SECONDARY_FEE) {
        throw new GameError(400, "INSUFFICIENT_FUNDS", "Not enough cash to set secondary specialisation.");
      }
      await chargeSpend(tx, userId, CAREERS.SWITCH_SECONDARY_FEE);
      await tx.transaction.create({
        data: { type: "career_switch_secondary", amount: CAREERS.SWITCH_SECONDARY_FEE, fromUserId: userId },
      });
    }
    await tx.user.update({
      where: { id: userId },
      data: { secondaryCareer: careerId },
    });
  }).then(() => getCareer(userId));
}

/** Resolved flat bonuses for heist/work. Secondary at half strength. */
export async function careerBonuses(userId: string) {
  const [user, holdings, base] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCareer: true, secondaryCareer: true },
    }),
    prisma.territoryHolding.count({ where: { userId } }),
    prisma.base.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  const sectors = (base ? 1 : 0) + holdings;

  let heistChanceFlat = 0;
  let heistAttackFlat = 0;
  let workCollectBonusPercent = 0;

  const apply = (id: CareerId | null, weight: number) => {
    if (!id) return;
    const b = CAREERS.BONUSES[id];
    if ("heistChanceFlat" in b && b.heistChanceFlat) {
      const need = "needsSectors" in b ? b.needsSectors : 0;
      if (sectors >= need) heistChanceFlat += b.heistChanceFlat * weight;
    }
    if ("heistAttackFlat" in b && b.heistAttackFlat) heistAttackFlat += b.heistAttackFlat * weight;
    if ("workCollectBonusPercent" in b && b.workCollectBonusPercent) {
      workCollectBonusPercent += b.workCollectBonusPercent * weight;
    }
  };

  apply(isCareerId(user?.primaryCareer) ? user!.primaryCareer as CareerId : null, 1);
  apply(isCareerId(user?.secondaryCareer) ? user!.secondaryCareer as CareerId : null, 0.5);

  return {
    heistChanceFlat: Math.round(heistChanceFlat),
    heistAttackFlat: Math.round(heistAttackFlat),
    workCollectBonusPercent: Math.round(workCollectBonusPercent * 10) / 10,
  };
}
