import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { heistStealAmount } from "../src/game/rewards.js";
import { RULES } from "../src/game/rules.js";
import { prisma } from "../src/prisma.js";
import { debitCash, debitVault } from "../src/services/economyService.js";
import { setHeistRng } from "../src/services/heistService.js";
import { app, auth, books, registerUser, userState } from "./helpers.js";

describe("reward math", () => {
  it("transfers an exact percent and rejects negatives", () => {
    expect(heistStealAmount(100_000)).toBe(10_000);
    expect(heistStealAmount(25_000)).toBe(2_500);
    expect(heistStealAmount(10_001)).toBe(1_000);
    expect(heistStealAmount(100_000, 100)).toBe(10_000);
    expect(heistStealAmount(100_000, 50)).toBe(10_000);
    expect(() => heistStealAmount(-1)).toThrow(/non-negative/);
    expect(() => heistStealAmount(1000, -5)).toThrow(/non-negative/);
  });
});

describe("heist money", () => {
  beforeEach(() => {
    setHeistRng(() => 1);
  });

  it("moves the exact percent from vault to cash on success", async () => {
    const attacker = await registerUser("Ada Crowe");
    const target = await registerUser("Bea Crowe");
    await prisma.vault.update({
      where: { userId: target.id },
      data: { balance: 100_000, level: 1 },
    });
    const before = await books();

    const res = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.amountStolen).toBe(10_000);
    expect(res.body.successChance).toBe(60);

    const attackerAfter = await userState(attacker.id);
    const targetAfter = await userState(target.id);
    expect(attackerAfter.cash).toBe(attacker.cash + 10_000);
    expect(targetAfter.vault).toBe(90_000);

    const tx = await prisma.transaction.findFirst({ where: { heistId: res.body.id } });
    expect(tx?.type).toBe("heist_payout");
    expect(tx?.amount).toBe(10_000);
    expect(tx?.fromUserId).toBe(target.id);
    expect(tx?.toUserId).toBe(attacker.id);

    const after = await books();
    expect(after.total).toBe(before.total);
  });

  it("transfers nothing on failure and still records the attempt", async () => {
    setHeistRng(() => 100);
    const attacker = await registerUser("Cara Crowe");
    const target = await registerUser("Dee Crowe");
    const beforeAttacker = await userState(attacker.id);
    const beforeTarget = await userState(target.id);
    const before = await books();

    const res = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(false);
    expect(res.body.amountStolen).toBe(0);
    expect(await userState(attacker.id)).toEqual(beforeAttacker);
    expect(await userState(target.id)).toEqual(beforeTarget);
    expect(await prisma.transaction.count({ where: { heistId: res.body.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: target.id } })).toBe(1);
    expect((await books()).total).toBe(before.total);
  });

  it("does not pay twice when the same thief immediately retries", async () => {
    const attacker = await registerUser("Eve Crowe");
    const target = await registerUser("Fay Crowe");
    const first = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });
    expect(first.status).toBe(201);
    const mid = await userState(attacker.id);
    const midVault = await userState(target.id);

    const second = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("COOLDOWN");
    expect(await userState(attacker.id)).toEqual(mid);
    expect(await userState(target.id)).toEqual(midVault);
    expect(await prisma.heist.count({ where: { attackerId: attacker.id } })).toBe(1);
  });

  it("rejects overdrafts and keeps books consistent", async () => {
    const user = await registerUser("Gil Crowe");
    await prisma.user.update({ where: { id: user.id }, data: { cash: 100 } });
    const before = await userState(user.id);

    const buy = await request(app)
      .post("/api/weapons/buy")
      .set(auth(user.token))
      .send({ weaponId: "weapon:0002" });
    expect(buy.status).toBe(400);
    expect(buy.body.code).toBe("INSUFFICIENT_FUNDS");

    const upgrade = await request(app).post("/api/vault/upgrade").set(auth(user.token)).send({});
    expect(upgrade.status).toBe(400);
    expect(upgrade.body.code).toBe("INSUFFICIENT_FUNDS");

    const withdraw = await request(app)
      .post("/api/vault/withdraw")
      .set(auth(user.token))
      .send({ amount: before.vault + 1 });
    expect(withdraw.status).toBe(400);
    expect(withdraw.body.code).toBe("INSUFFICIENT_FUNDS");

    const negative = await request(app)
      .post("/api/vault/withdraw")
      .set(auth(user.token))
      .send({ amount: -20 });
    expect(negative.status).toBe(400);
    expect(negative.body.code).toBe("VALIDATION");

    expect(await userState(user.id)).toEqual(before);
  });

  it("rejects a negative debit without touching cash", async () => {
    const user = await registerUser("Hana Crowe");
    const before = await userState(user.id);
    await expect(
      prisma.$transaction((tx) => debitCash(tx, user.id, -5)),
    ).rejects.toThrow(/positive integer/);
    expect(await userState(user.id)).toEqual(before);
  });

  it("lets two concurrent vault debits take the money only once", async () => {
    const user = await registerUser("Ivo Crowe");
    await prisma.vault.update({ where: { userId: user.id }, data: { balance: 10_000 } });
    const results = await Promise.all(
      [8_000, 8_000].map((amount) =>
        prisma.$transaction(async (tx) => debitVault(tx, user.id, amount)),
      ),
    );
    const wins = results.filter(Boolean).length;
    const state = await userState(user.id);
    expect(wins).toBe(1);
    expect(state.vault).toBe(2_000);
    expect(state.vault).toBeGreaterThanOrEqual(0);
  });

  it("keeps concurrent heists from overdrawing the vault", async () => {
    const first = await registerUser("Jen Crowe");
    const second = await registerUser("Kit Crowe");
    const target = await registerUser("Lee Crowe");
    await prisma.vault.update({
      where: { userId: target.id },
      data: { balance: 100_000, level: 1 },
    });
    const before = await books();

    const [left, right] = await Promise.all([
      request(app)
        .post("/api/heists")
        .set(auth(first.token))
        .send({ targetUserId: target.id, weaponId: "weapon:0001" }),
      request(app)
        .post("/api/heists")
        .set(auth(second.token))
        .send({ targetUserId: target.id, weaponId: "weapon:0001" }),
    ]);

    for (const res of [left, right]) {
      expect([201, 409]).toContain(res.status);
    }
    const heists = await prisma.heist.findMany({
      where: { targetId: target.id, success: true },
    });
    const stolen = heists.reduce((sum, heist) => sum + heist.amountStolen, 0);
    const targetAfter = await userState(target.id);
    expect(targetAfter.vault).toBeGreaterThanOrEqual(0);
    expect(targetAfter.vault + stolen).toBe(100_000);
    expect(stolen).toBeLessThanOrEqual(100_000);
    expect((await books()).total).toBe(before.total);
    expect(heists.length).toBeLessThanOrEqual(2);
  });

  it("moves vault money to cash on withdraw and sinks cash on upgrades", async () => {
    const user = await registerUser("Mo Crowe");
    const before = await books();
    const withdrawn = 5_000;
    const withdraw = await request(app)
      .post("/api/vault/withdraw")
      .set(auth(user.token))
      .send({ amount: withdrawn });
    expect(withdraw.status).toBe(200);
    expect(withdraw.body.balance).toBe(user.vaultBalance - withdrawn);
    expect(withdraw.body.cash).toBe(user.cash + withdrawn);
    expect((await books()).total).toBe(before.total);

    const upgrade = await request(app)
      .post("/api/weapons/upgrade")
      .set(auth(user.token))
      .send({ weaponId: "weapon:0001" });
    expect(upgrade.status).toBe(200);
    expect(upgrade.body.upgradeLevel).toBe(2);
    const cost = RULES.WEAPON_UPGRADE_COSTS["weapon:0001"][1];
    expect((await userState(user.id)).cash).toBe(user.cash + withdrawn - cost);
    expect((await books()).total).toBe(before.total - cost);
  });
});
