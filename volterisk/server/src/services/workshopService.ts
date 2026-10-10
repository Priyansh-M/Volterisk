import { territoryModById, vaultModById, weaponModById } from "../game/careersAndMods.js";
import {
  CRAFT_CANCEL_REFUND,
  CRAFT_RECIPES,
  WORKSHOP,
  blueprintItemId,
  recipeById,
  raritySpendPlan,
} from "../game/workshopEconomy.js";
import { GameError } from "../game/errors.js";
import { prisma } from "../prisma.js";
import { chargeSpend } from "./economyService.js";
import { creditItem, debitItem, ownedMap } from "./inventoryService.js";
import { writeNotification } from "./notificationService.js";

export async function ensureWorkshop(userId: string) {
  const existing = await prisma.property.findFirst({
    where: { userId, catalogId: WORKSHOP.CATALOG_ID },
  });
  if (existing) return existing;
  return prisma.property.create({
    data: { userId, catalogId: WORKSHOP.CATALOG_ID, level: 1 },
  });
}

async function assertWorkshopAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reputationLevel: true },
  });
  if (!user || user.reputationLevel < WORKSHOP.MIN_REPUTATION) {
    throw new GameError(
      403,
      "WORKSHOP_LOCKED",
      `Minimum reputation level ${WORKSHOP.MIN_REPUTATION} to access.`,
    );
  }
}

function craftDurationMs(baseMs: number, workshopLevel: number) {
  const cut = WORKSHOP.TIME_REDUCTION[Math.min(workshopLevel, WORKSHOP.MAX_LEVEL)] ?? 0;
  return Math.max(WORKSHOP.MIN_CRAFT_MS, Math.floor(baseMs * (1 - cut)));
}

function presentJob(job: {
  id: string;
  recipeId: string;
  startsAt: Date;
  completesAt: Date;
  collectedAt: Date | null;
  cancelledAt: Date | null;
}) {
  const recipe = recipeById(job.recipeId);
  const now = Date.now();
  const start = job.startsAt.getTime();
  const end = job.completesAt.getTime();
  const done = Boolean(job.collectedAt) || Boolean(job.cancelledAt);
  const ready = !done && now >= end;
  const progress = done ? 1 : Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
  return {
    id: job.id,
    recipeId: job.recipeId,
    name: recipe?.name ?? job.recipeId,
    startsAt: job.startsAt.toISOString(),
    completesAt: job.completesAt.toISOString(),
    collectedAt: job.collectedAt?.toISOString() ?? null,
    cancelledAt: job.cancelledAt?.toISOString() ?? null,
    ready,
    progress,
    remainingMs: ready || done ? 0 : Math.max(0, end - now),
    status: job.cancelledAt ? "cancelled" : job.collectedAt ? "collected" : ready ? "ready" : "crafting",
  };
}

export async function getWorkshop(userId: string) {
  await assertWorkshopAccess(userId);
  const shop = await ensureWorkshop(userId);
  const props = await prisma.property.findMany({ where: { userId }, select: { catalogId: true, level: true } });
  const ownedProps = new Set(props.map((p) => p.catalogId));
  const inv = await ownedMap(userId);
  const active = await prisma.craftingJob.findMany({
    where: { userId, collectedAt: null, cancelledAt: null },
    orderBy: { startsAt: "asc" },
  });
  const slots = WORKSHOP.JOB_SLOTS[shop.level] ?? 1;
  const upgradeFrom = shop.level;
  const upgrade = WORKSHOP.UPGRADES[upgradeFrom] ?? null;

  // Permanent unlock: every recipe with workshopLevel <= current level stays listed forever.
  const recipes = CRAFT_RECIPES.filter((r) => shop.level >= r.workshopLevel).map((r) => {
    const bpId = blueprintItemId(r.modId);
    const hasBp = !r.blueprint || (inv[bpId] ?? 0) > 0;
    const missingMats = Object.entries(r.materials).filter(([id, n]) => (inv[id] ?? 0) < n);
    const missingProps = (r.requiresProperties ?? []).filter((id) => !ownedProps.has(id));
    const effectiveMs = craftDurationMs(r.baseMs, shop.level);
    let lockReason: string | null = null;
    if (!hasBp) lockReason = "Blueprint required";
    else if (missingProps.length) lockReason = `Needs ${missingProps.join(", ")}`;
    else if (missingMats.length) lockReason = "Missing materials";
    else if (active.length >= slots) lockReason = "Crafting capacity full";
    const modDef =
      r.kind === "weapon"
        ? weaponModById(r.modId)
        : r.kind === "vault"
          ? vaultModById(r.modId)
          : territoryModById(r.modId);
    return {
      ...r,
      description: modDef?.description ?? "",
      blueprintId: r.blueprint ? bpId : null,
      hasBlueprint: hasBp,
      ownedMaterials: Object.fromEntries(Object.keys(r.materials).map((id) => [id, inv[id] ?? 0])),
      missingMaterials: Object.fromEntries(missingMats),
      missingProperties: missingProps,
      effectiveMs,
      available: !lockReason,
      lockReason,
    };
  });

  return {
    level: shop.level,
    maxLevel: WORKSHOP.MAX_LEVEL,
    slots,
    activeJobs: active.length,
    timeReduction: WORKSHOP.TIME_REDUCTION[shop.level] ?? 0,
    upgrade: upgrade
      ? {
          fromLevel: shop.level,
          toLevel: shop.level + 1,
          ...upgrade,
        }
      : null,
    jobs: active.map(presentJob),
    recipes,
  };
}

export async function upgradeWorkshop(userId: string) {
  await assertWorkshopAccess(userId);
  return prisma.$transaction(async (tx) => {
    const shop = await tx.property.findFirst({ where: { userId, catalogId: WORKSHOP.CATALOG_ID } });
    if (!shop) throw new GameError(400, "NO_WORKSHOP", "Workshop missing.");
    const cost = WORKSHOP.UPGRADES[shop.level];
    if (!cost) throw new GameError(400, "MAX_LEVEL", "Workshop is already at maximum.");
    const inv = await ownedMap(userId, tx);
    const plan = raritySpendPlan(inv, cost);
    if (!plan) throw new GameError(400, "MATERIALS", "Not enough materials for that upgrade.");
    await chargeSpend(tx, userId, cost.cash);
    for (const [itemId, n] of Object.entries(plan)) {
      const ok = await debitItem(tx, userId, itemId, n);
      if (!ok) throw new GameError(400, "MATERIALS", "Material balance shifted.");
    }
    const updated = await tx.property.update({
      where: { id: shop.id },
      data: { level: { increment: 1 } },
    });
    await tx.transaction.create({
      data: { type: "workshop_upgrade", amount: cost.cash, fromUserId: userId },
    });
    return { level: updated.level };
  }).then(() => getWorkshop(userId));
}

export async function startCraft(userId: string, recipeId: string) {
  await assertWorkshopAccess(userId);
  const recipe = recipeById(recipeId);
  if (!recipe) throw new GameError(400, "UNKNOWN_RECIPE", "Unknown recipe.");
  return prisma.$transaction(async (tx) => {
    let shop = await tx.property.findFirst({ where: { userId, catalogId: WORKSHOP.CATALOG_ID } });
    if (!shop) {
      shop = await tx.property.create({ data: { userId, catalogId: WORKSHOP.CATALOG_ID, level: 1 } });
    }
    if (shop.level < recipe.workshopLevel) {
      throw new GameError(400, "WORKSHOP_LEVEL", `Workshop level ${recipe.workshopLevel} required.`);
    }
    const slots = WORKSHOP.JOB_SLOTS[shop.level] ?? 1;
    const active = await tx.craftingJob.count({
      where: { userId, collectedAt: null, cancelledAt: null },
    });
    if (active >= slots) throw new GameError(400, "CAPACITY", "Crafting capacity full.");

    if (recipe.blueprint) {
      const bp = await tx.inventoryItem.findUnique({
        where: { userId_itemId: { userId, itemId: blueprintItemId(recipe.modId) } },
      });
      if (!bp || bp.quantity < 1) throw new GameError(400, "BLUEPRINT", "Blueprint required.");
    }
    for (const propId of recipe.requiresProperties ?? []) {
      const prop = await tx.property.findFirst({ where: { userId, catalogId: propId } });
      if (!prop) throw new GameError(400, "PROPERTY_REQUIRED", `Requires ${propId}.`);
    }

    const user = await tx.user.findUnique({ where: { id: userId }, select: { cash: true } });
    if (!user || user.cash < recipe.cash) throw new GameError(400, "INSUFFICIENT_FUNDS", "Not enough cash.");
    await chargeSpend(tx, userId, recipe.cash);
    for (const [itemId, n] of Object.entries(recipe.materials)) {
      const ok = await debitItem(tx, userId, itemId, n);
      if (!ok) throw new GameError(400, "MATERIALS", `Missing ${itemId}.`);
    }
    const duration = craftDurationMs(recipe.baseMs, shop.level);
    const startsAt = new Date();
    const completesAt = new Date(startsAt.getTime() + duration);
    const job = await tx.craftingJob.create({
      data: { userId, recipeId: recipe.id, startsAt, completesAt },
    });
    await tx.transaction.create({
      data: { type: "craft_start", amount: recipe.cash, fromUserId: userId },
    });
    return presentJob(job);
  });
}

export async function cancelCraft(userId: string, jobId: string) {
  await assertWorkshopAccess(userId);
  return prisma.$transaction(async (tx) => {
    const job = await tx.craftingJob.findFirst({
      where: { id: jobId, userId, collectedAt: null, cancelledAt: null },
    });
    if (!job) throw new GameError(404, "NO_JOB", "No active job.");
    if (Date.now() >= job.completesAt.getTime()) {
      throw new GameError(400, "COMPLETE", "Job already finished. Collect it instead.");
    }
    const recipe = recipeById(job.recipeId);
    if (!recipe) throw new GameError(400, "UNKNOWN_RECIPE", "Unknown recipe.");
    const progress =
      (Date.now() - job.startsAt.getTime()) / Math.max(1, job.completesAt.getTime() - job.startsAt.getTime());
    const band = CRAFT_CANCEL_REFUND.find((r) => progress < r.under) ?? CRAFT_CANCEL_REFUND[CRAFT_CANCEL_REFUND.length - 1];
    const rate = band.rate;
    const cashBack = Math.floor(recipe.cash * rate);
    const closed = await tx.craftingJob.updateMany({
      where: { id: job.id, cancelledAt: null, collectedAt: null },
      data: { cancelledAt: new Date() },
    });
    if (closed.count !== 1) throw new GameError(409, "ALREADY_CLOSED", "Job already closed.");
    if (cashBack > 0) {
      await tx.user.update({ where: { id: userId }, data: { cash: { increment: cashBack } } });
      await tx.transaction.create({
        data: { type: "craft_cancel_refund", amount: cashBack, toUserId: userId },
      });
    }
    for (const [itemId, n] of Object.entries(recipe.materials)) {
      const back = Math.floor(n * rate);
      if (back > 0) await creditItem(tx, userId, itemId, back);
    }
    return { refundRate: rate, cashBack, jobId: job.id };
  });
}

export async function collectCraft(userId: string, jobId: string) {
  await assertWorkshopAccess(userId);
  return prisma.$transaction(async (tx) => {
    const job = await tx.craftingJob.findFirst({
      where: { id: jobId, userId, collectedAt: null, cancelledAt: null },
    });
    if (!job) throw new GameError(404, "NO_JOB", "No job to collect.");
    if (Date.now() < job.completesAt.getTime()) {
      throw new GameError(400, "TOO_EARLY", "Crafting is not finished.");
    }
    const recipe = recipeById(job.recipeId);
    if (!recipe) throw new GameError(400, "UNKNOWN_RECIPE", "Unknown recipe.");
    const claimed = await tx.craftingJob.updateMany({
      where: { id: job.id, collectedAt: null, cancelledAt: null },
      data: { collectedAt: new Date() },
    });
    if (claimed.count !== 1) throw new GameError(409, "ALREADY_COLLECTED", "Already collected.");
    const mod = await tx.modOwned.create({
      data: {
        userId,
        modId: recipe.modId,
        kind: recipe.kind,
        status: "inventory",
      },
    });
    const now = new Date();
    await tx.craftLedger.upsert({
      where: { userId_modId: { userId, modId: recipe.modId } },
      create: { userId, modId: recipe.modId, count: 1, firstAt: now, lastAt: now },
      update: { count: { increment: 1 }, lastAt: now },
    });
    await writeNotification(tx, {
      userId,
      title: "Crafting complete",
      body: `${recipe.name} is ready in your modification inventory.`,
      severity: "INFO",
    });
    return { modInstanceId: mod.id, modId: recipe.modId, name: recipe.name };
  });
}

/** Preview refund for UI. */
export function previewCancelRefund(startsAt: Date, completesAt: Date, cash: number, materials: Record<string, number>) {
  const progress = (Date.now() - startsAt.getTime()) / Math.max(1, completesAt.getTime() - startsAt.getTime());
  const band = CRAFT_CANCEL_REFUND.find((r) => progress < r.under) ?? CRAFT_CANCEL_REFUND[CRAFT_CANCEL_REFUND.length - 1];
  const rate = band.rate;
  return {
    rate,
    cashBack: Math.floor(cash * rate),
    materials: Object.fromEntries(Object.entries(materials).map(([id, n]) => [id, Math.floor(n * rate)])),
  };
}
