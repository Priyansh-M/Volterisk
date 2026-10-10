import { PROPERTY_MATERIAL_YIELDS } from "../game/workshopEconomy.js";
import { prisma } from "../prisma.js";
import { creditItem } from "./inventoryService.js";
import { writeNotification } from "./notificationService.js";

/** Skip re-checking the same UTC noon after a full settle (or confirmed empty). */
const materialYieldSettledNoon = new Map<string, number>();

/** Most recent 12:00 GMT that has already passed. */
export function latestMaterialNoon(now = new Date()) {
  const noon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
  if (now.getTime() < noon.getTime()) noon.setUTCDate(noon.getUTCDate() - 1);
  return noon;
}

function labelProperty(catalogId: string) {
  return catalogId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Credit daily property materials for one player when today's 12:00 GMT has passed. */
export async function settlePropertyMaterialYields(userId: string): Promise<number> {
  const noon = latestMaterialNoon();
  const now = new Date();
  if (now.getTime() < noon.getTime()) return 0;
  if ((materialYieldSettledNoon.get(userId) ?? 0) >= noon.getTime()) return 0;

  const catalogIds = PROPERTY_MATERIAL_YIELDS.map((r) => r.catalogId);
  const txTypes = PROPERTY_MATERIAL_YIELDS.map((r) => r.txType);
  const [props, already] = await Promise.all([
    prisma.property.findMany({
      where: { userId, catalogId: { in: catalogIds } },
      select: { catalogId: true, level: true },
    }),
    prisma.transaction.findMany({
      where: { fromUserId: userId, type: { in: txTypes }, createdAt: { gte: noon } },
      select: { type: true },
    }),
  ]);
  if (props.length === 0) {
    materialYieldSettledNoon.set(userId, noon.getTime());
    return 0;
  }
  const paidTypes = new Set(already.map((row) => row.type));

  let paid = 0;
  for (const def of PROPERTY_MATERIAL_YIELDS) {
    const owned = props.find((p) => p.catalogId === def.catalogId);
    if (!owned) continue;
    const drops = def.drops(owned.level).filter((d) => d.quantity > 0);
    if (drops.length === 0) continue;
    if (paidTypes.has(def.txType)) continue;

    const total = drops.reduce((sum, d) => sum + d.quantity, 0);
    await prisma.$transaction(async (tx) => {
      const dup = await tx.transaction.findFirst({
        where: { type: def.txType, fromUserId: userId, createdAt: { gte: noon } },
        select: { id: true },
      });
      if (dup) return;
      for (const drop of drops) {
        await creditItem(tx, userId, drop.materialId, drop.quantity);
      }
      await tx.transaction.create({
        data: {
          type: def.txType,
          amount: total,
          fromUserId: userId,
          createdAt: noon,
        },
      });
      const parts = drops.map((d) => `${d.materialName} ×${d.quantity}`).join(", ");
      await writeNotification(tx, {
        userId,
        title: def.title,
        body: `${parts} delivered from your ${labelProperty(def.catalogId)} (L${owned.level}) at 12:00 GMT. Added to Materials.`,
        severity: "INFO",
      });
    });
    paid += 1;
  }
  materialYieldSettledNoon.set(userId, noon.getTime());
  return paid;
}

/** Sweep eligible owners after 12:00 GMT (interval + boot). */
export async function settlePropertyMaterialYieldsNoonGmt(): Promise<number> {
  const noon = latestMaterialNoon();
  const now = new Date();
  if (now.getTime() < noon.getTime()) return 0;

  const catalogIds = PROPERTY_MATERIAL_YIELDS.map((r) => r.catalogId);
  const owners = await prisma.property.findMany({
    where: { catalogId: { in: [...catalogIds] } },
    select: { userId: true },
    distinct: ["userId"],
    take: 400,
  });
  let n = 0;
  for (const row of owners) {
    const got = await settlePropertyMaterialYields(row.userId);
    if (got > 0) n += 1;
  }
  return n;
}
