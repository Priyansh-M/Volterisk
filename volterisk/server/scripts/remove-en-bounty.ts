import { prisma } from "../src/prisma.js";

async function main() {
  const police = await prisma.user.findUnique({ where: { usernameKey: "police" }, select: { id: true } });
  const targets = await prisma.user.findMany({
    where: { username: { in: ["E.N", "e.n", "E.n", "e.N"] } },
    select: { id: true, username: true, reputationLevel: true },
  });
  console.log("police:", police?.id ?? "none");
  console.log("targets:", JSON.stringify(targets));
  if (!police || targets.length === 0) {
    console.log("Nothing to remove.");
    return;
  }
  const targetIds = targets.map((t) => t.id);
  const found = await prisma.bounty.findMany({
    where: { posterId: police.id, targetId: { in: targetIds } },
    select: { id: true, status: true, amount: true, targetId: true },
  });
  console.log("police bounties on target:", JSON.stringify(found));
  const result = await prisma.bounty.deleteMany({
    where: { posterId: police.id, targetId: { in: targetIds } },
  });
  console.log("deleted bounties:", result.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
