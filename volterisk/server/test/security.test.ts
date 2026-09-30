import request from "supertest";
import { describe, expect, it } from "vitest";
import { successChance } from "../src/game/probability.js";
import { attackPower, vaultDefense } from "../src/game/rules.js";
import { prisma } from "../src/prisma.js";
import { setHeistRng } from "../src/services/heistService.js";
import { app, auth, registerUser, userState } from "./helpers.js";

describe("heist security", () => {
  it("rejects client-supplied level, chance, and reward", async () => {
    const attacker = await registerUser("Nia Crowe");
    const target = await registerUser("Omar Crowe");
    const beforeA = await userState(attacker.id);
    const beforeT = await userState(target.id);

    const res = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({
        targetUserId: target.id,
        weaponId: "weapon:0001",
        weaponLevel: 99,
        vaultLevel: 1,
        successChance: 95,
        reward: 100,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
    expect(await userState(attacker.id)).toEqual(beforeA);
    expect(await userState(target.id)).toEqual(beforeT);
    expect(await prisma.heist.count()).toBe(0);
  });

  it("uses the server chance for the owned weapon, not a client number", async () => {
    setHeistRng(() => 1);
    const attacker = await registerUser("Pia Crowe");
    const target = await registerUser("Quin Crowe");
    await prisma.userWeapon.updateMany({
      where: { userId: attacker.id, weaponId: "weapon:0001" },
      data: { upgradeLevel: 2 },
    });
    await prisma.vault.update({ where: { userId: target.id }, data: { level: 1 } });

    const bought = await request(app)
      .post("/api/shop/buy")
      .set(auth(attacker.token))
      .send({ itemId: "estimate-predictor" });
    expect(bought.status).toBe(201);
    const preview = await request(app)
      .post("/api/heists/estimate")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001", successChance: 99 });
    const expected = successChance(attackPower(1, 2), vaultDefense("standard", 1));
    expect(preview.status).toBe(400);
    const clean = await request(app)
      .post("/api/heists/estimate")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });
    expect(clean.status).toBe(200);
    expect(clean.body).toEqual({ estimatedChance: expected });
    expect(expected).toBe(61);
    expect(await prisma.heist.count()).toBe(0);
    const left = await prisma.inventoryItem.findFirst({
      where: { userId: attacker.id, itemId: "estimate-predictor" },
    });
    expect(left?.quantity ?? 0).toBe(0);
    const again = await request(app)
      .post("/api/heists/estimate")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe("NO_PREDICTOR");

    const heist = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });
    expect(heist.status).toBe(201);
    expect(heist.body.successChance).toBe(expected);
    expect(heist.body.weaponLevel).toBe(2);
    expect(heist.body.vaultLevel).toBe(1);
  });

  it("does not let a second attempt skip cooldown", async () => {
    setHeistRng(() => 100);
    const attacker = await registerUser("Ren Crowe");
    const target = await registerUser("Sol Crowe");
    const first = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });
    expect(first.status).toBe(201);
    expect(first.body.success).toBe(false);

    const sneaky = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001", cooldownHours: 0 });
    expect(sneaky.status).toBe(400);

    const again = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("COOLDOWN");
    expect(again.body.cooldownEndsAt).toBeTruthy();
  });

  it("rejects robbing yourself and unknown targets", async () => {
    const attacker = await registerUser("Tess Crowe");
    const self = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: attacker.id, weaponId: "weapon:0001" });
    expect(self.status).toBe(400);
    expect(self.body.code).toBe("SELF_TARGET");

    const missing = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: "not-a-real-player", weaponId: "weapon:0001" });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("INVALID_TARGET");
    expect(await prisma.heist.count()).toBe(0);
  });

  it("enforces the 12 hour protection window", async () => {
    setHeistRng(() => 1);
    const attacker = await registerUser("Uma Crowe");
    const previous = await registerUser("Vic Crowe");
    const target = await registerUser("Wes Crowe");
    await prisma.vault.update({
      where: { userId: target.id },
      data: { balance: 80_000, level: 1 },
    });
    await prisma.heist.create({
      data: {
        attackerId: previous.id,
        targetId: target.id,
        weaponId: "weapon:0001",
        weaponLevel: 1,
        vaultLevel: 1,
        successChance: 60,
        success: true,
        amountStolen: 1_000,
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    const blocked = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("TARGET_PROTECTED");

    await prisma.heist.updateMany({
      where: { targetId: target.id },
      data: { createdAt: new Date(Date.now() - 13 * 60 * 60 * 1000) },
    });

    const open = await request(app)
      .post("/api/heists")
      .set(auth(attacker.token))
      .send({ targetUserId: target.id, weaponId: "weapon:0001" });
    expect(open.status).toBe(201);
    expect(open.body.success).toBe(true);
    expect(open.body.amountStolen).toBe(8_000);
  });

  it("hides exact vault balances and requires auth", async () => {
    const viewer = await registerUser("Xia Crowe");
    const target = await registerUser("Yara Crowe");
    await prisma.vault.update({
      where: { userId: target.id },
      data: { balance: 42_000, level: 2 },
    });
    const res = await request(app).get("/api/heists/targets").set(auth(viewer.token));
    expect(res.status).toBe(200);
    const card = res.body.players.find((row: { userId: string }) => row.userId === target.id);
    expect(res.body.npc.find((row: { userId: string }) => row.userId === target.id)).toBeUndefined();
    expect(card).toMatchObject({
      username: target.username,
      vaultLevel: 2,
      wealthBucket: "modest",
      vulnerable: true,
    });
    expect(JSON.stringify(card)).not.toContain("42000");
    expect(JSON.stringify(card)).not.toContain("42,000");

    const hidden = await request(app).get("/api/me");
    expect(hidden.status).toBe(401);
  });
});
