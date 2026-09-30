import { GameError } from "../game/errors.js";
import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { creditCash } from "./economyService.js";

type Owned = { catalogId: string; level: number };

function conditionMet(
  condition: (typeof RULES.REPUTATION)[number]["conditions"][number],
  owned: Owned[],
  hasJob: boolean,
) {
  if (condition.kind === "passive") return hasJob;
  const row = owned.find((item) => item.catalogId === condition.id);
  return Boolean(row && row.level >= (condition.minLevel ?? 1));
}

export async function getReputation(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reputationLevel: true, passiveJobId: true, cash: true },
  });
  if (!user) throw new GameError(404, "NOT_FOUND", "Player not found.");
  const owned = await prisma.property.findMany({
    where: { userId },
    select: { catalogId: true, level: true },
  });
  const next = RULES.REPUTATION.find((rung) => rung.level === user.reputationLevel + 1) ?? null;
  const conditions = (next?.conditions ?? []).map((condition, index) => ({
    id: `${condition.kind}:${condition.id ?? "job"}:${index}`,
    label: condition.label,
    met: conditionMet(condition, owned, Boolean(user.passiveJobId)),
  }));
  const met = conditions.filter((row) => row.met).length;
  return {
    level: user.reputationLevel,
    maxLevel: RULES.REPUTATION_MAX_LEVEL,
    nextLevel: next?.level ?? null,
    reward: next?.reward ?? null,
    ready: Boolean(next) && conditions.length > 0 && met === conditions.length,
    met,
    total: conditions.length,
    cash: user.cash,
    conditions,
  };
}

export async function claimReputation(userId: string) {
  const before = await getReputation(userId);
  if (!before.nextLevel || !before.ready || before.reward == null) {
    throw new GameError(400, "NOT_READY", "The next level is not open yet.");
  }
  const reward = before.reward;
  const nextLevel = before.nextLevel;
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { reputationLevel: true, passiveJobId: true },
    });
    if (!user || user.reputationLevel !== before.level) {
      throw new GameError(409, "ALREADY_CLAIMED", "That level is already on your file.");
    }
    const owned = await tx.property.findMany({
      where: { userId },
      select: { catalogId: true, level: true },
    });
    const rung = RULES.REPUTATION.find((entry) => entry.level === nextLevel);
    if (!rung || !rung.conditions.every((condition) => conditionMet(condition, owned, Boolean(user.passiveJobId)))) {
      throw new GameError(400, "NOT_READY", "The next level is not open yet.");
    }
    const raised = await tx.user.updateMany({
      where: { id: userId, reputationLevel: before.level },
      data: { reputationLevel: nextLevel },
    });
    if (raised.count !== 1) {
      throw new GameError(409, "ALREADY_CLAIMED", "That level is already on your file.");
    }
    await creditCash(tx, userId, reward);
    await tx.transaction.create({
      data: { type: "reputation_reward", amount: reward, toUserId: userId },
    });
  });
  return getReputation(userId);
}
