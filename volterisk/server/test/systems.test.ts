import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { RULES, wealthBandLabel } from "../src/game/rules.js";
import { prisma } from "../src/prisma.js";
import { setHeistRng } from "../src/services/heistService.js";
import { createPlayer } from "../src/services/userService.js";
import { app, auth, registerUser, userState } from "./helpers.js";

const sector = {
  sectorId: "north-reach-07",
  landmassId: "north-reach",
  regionName: "North Reach",
};

describe("onboarding", () => {
  it("onboarding claim idempotent", async () => {
    const user = await registerUser("Ada Crowe");
    const first = await request(app).post("/api/onboarding/claim").set(auth(user.token)).send({});
    const second = await request(app).post("/api/onboarding/claim").set(auth(user.token)).send({});

    expect(first.status).toBe(200);
    expect(first.body.cash).toBe(RULES.STARTING_CASH);
    expect(first.body.items).toEqual([
      {
        id: "weapon:0001",
        name: "Rusty Crowbar",
        label: "WEAPON 0001",
        level: 1,
      },
    ]);
    expect(second.body).toEqual(first.body);
    expect(await userState(user.id)).toMatchObject({ cash: RULES.STARTING_CASH });
    expect(
      await prisma.transaction.count({
        where: { type: "starter_grant", toUserId: user.id },
      }),
    ).toBe(1);
    expect(await prisma.userWeapon.count({ where: { userId: user.id, weaponId: "weapon:0001" } })).toBe(1);

    const me = await request(app).get("/api/me").set(auth(user.token));
    expect(me.status).toBe(200);
    expect(me.body.onboarding).toEqual({
      needsIntro: true,
      hasClaimedStarter: true,
      hasBase: false,
    });
    expect(me.body.title).toBe("Street Operator");
    expect(me.body.level).toBe(1);
    expect(me.body.rank).toBeGreaterThanOrEqual(1);
    expect(me.body.base).toBeNull();
    expect(me.body.cash).toBe(RULES.STARTING_CASH);
  });
});

describe("territory", () => {
  it("double-claim rejected", async () => {
    const left = await registerUser("Bea Crowe");
    const right = await registerUser("Cara Crowe");
    const [first, second] = await Promise.all([
      request(app).post("/api/map/base").set(auth(left.token)).send(sector),
      request(app).post("/api/map/base").set(auth(right.token)).send(sector),
    ]);
    const results = [first, second];
    const won = results.filter((res) => res.status === 201);
    const lost = results.filter((res) => res.status === 409);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0].body).toEqual({
      error: { code: "SECTOR_OCCUPIED", message: expect.any(String) },
    });
    expect(won[0].body.base).toMatchObject(sector);
    expect(await prisma.base.count({ where: { sectorId: sector.sectorId } })).toBe(1);

    const winner = won[0].body.base.sectorId === sector.sectorId ? (first.status === 201 ? left : right) : left;
    const owner = first.status === 201 ? left : right;
    const map = await request(app).get("/api/map/bases").set(auth(owner.token));
    expect(map.status).toBe(200);
    expect(map.body.bases).toHaveLength(1);
    const pin = map.body.bases[0];
    expect(pin.isYou).toBe(true);
    expect(pin.player.estimatedWealth).toBe(wealthBandLabel(RULES.STARTING_CASH + RULES.STARTING_VAULT_BALANCE));
    expect(JSON.stringify(pin.player)).not.toContain(String(RULES.STARTING_CASH));
    expect(pin.player).not.toHaveProperty("netWorth");

    const dossier = await request(app)
      .get(`/api/players/${encodeURIComponent(owner.username)}/public`)
      .set(auth(winner.token));
    expect(dossier.status).toBe(200);
    expect(dossier.body.username).toBe(owner.username);
    expect(dossier.body.base).toMatchObject(sector);
    expect(dossier.body).not.toHaveProperty("netWorth");
    expect(dossier.body).not.toHaveProperty("cash");
  });

  it("second base rejected", async () => {
    const user = await registerUser("Dee Crowe");
    const first = await request(app).post("/api/map/base").set(auth(user.token)).send(sector);
    expect(first.status).toBe(201);
    const second = await request(app)
      .post("/api/map/base")
      .set(auth(user.token))
      .send({ ...sector, sectorId: "north-reach-08", regionName: "North Cut" });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("ALREADY_HAS_BASE");
    expect(await prisma.base.count({ where: { userId: user.id } })).toBe(1);

    const me = await request(app).get("/api/me").set(auth(user.token));
    expect(me.body.onboarding.hasBase).toBe(true);
    expect(me.body.base).toMatchObject(sector);
  });
});

describe("work contracts", () => {
  it("collect-too-early rejected", async () => {
    const user = await registerUser("Eve Crowe");
    const before = await userState(user.id);
    const board = await request(app).get("/api/work/contracts").set(auth(user.token));
    expect(board.status).toBe(200);
    const offer = board.body.contracts.find((row: { available: boolean }) => row.available);
    expect(offer).toBeTruthy();

    const accepted = await request(app)
      .post("/api/work/contracts/accept")
      .set(auth(user.token))
      .send({ contractId: offer.id });
    expect(accepted.status).toBe(201);
    expect(accepted.body.active.reward).toBe(offer.reward);

    const early = await request(app).post("/api/work/contracts/collect").set(auth(user.token)).send({});
    expect(early.status).toBe(409);
    expect(early.body.code).toBe("TOO_EARLY");
    expect(await userState(user.id)).toEqual(before);
    expect(await prisma.transaction.count({ where: { type: "contract_payout", toUserId: user.id } })).toBe(0);
    expect(await prisma.contractRun.count({ where: { userId: user.id, collectedAt: { not: null } } })).toBe(0);
  });

  it("reward paid once", async () => {
    const user = await registerUser("Fay Crowe");
    const board = await request(app).get("/api/work/contracts").set(auth(user.token));
    const offer = board.body.contracts.find((row: { available: boolean }) => row.available);
    const accepted = await request(app)
      .post("/api/work/contracts/accept")
      .set(auth(user.token))
      .send({ contractId: offer.id });
    expect(accepted.status).toBe(201);
    const reward = accepted.body.active.reward as number;
    await prisma.contractRun.updateMany({
      where: { userId: user.id, collectedAt: null },
      data: { completesAt: new Date(Date.now() - 1000) },
    });
    const before = await userState(user.id);

    const [left, right] = await Promise.all([
      request(app).post("/api/work/contracts/collect").set(auth(user.token)).send({}),
      request(app).post("/api/work/contracts/collect").set(auth(user.token)).send({}),
    ]);
    const ok = [left, right].filter((res) => res.status === 200);
    const denied = [left, right].filter((res) => res.status !== 200);
    expect(ok).toHaveLength(1);
    expect(denied).toHaveLength(1);
    expect(ok[0].body.reward).toBe(reward);
    expect(ok[0].body.cash).toBe(before.cash + reward);

    const again = await request(app).post("/api/work/contracts/collect").set(auth(user.token)).send({});
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect((await userState(user.id)).cash).toBe(before.cash + reward);
    const payouts = await prisma.transaction.findMany({
      where: { type: "contract_payout", toUserId: user.id },
    });
    expect(payouts).toHaveLength(1);
    expect(payouts[0].amount).toBe(reward);
  });
});

describe("heist boards", () => {
  beforeEach(() => {
    setHeistRng(() => 1);
  });

  it("puts seeded night-crew on npc and real accounts on players", async () => {
    const { ensureNightCrew, NIGHT_CREW } = await import("../src/services/nightCrew.js");
    const player = await registerUser("Nell Crowe");
    const other = await registerUser("Otto Crowe");
    await ensureNightCrew();

    const board = await request(app).get("/api/heists/targets").set(auth(player.token));
    expect(board.status).toBe(200);
    const npcNames = board.body.npc.map((row: { username: string }) => row.username);
    const playerNames = board.body.players.map((row: { username: string }) => row.username);
    const { NPC_STATIONS } = await import("../src/services/nightCrew.js");
    expect(npcNames.sort()).toEqual(NPC_STATIONS.map((station) => station.username).sort());
    for (const bot of NIGHT_CREW) {
      if (!NPC_STATIONS.some((station) => station.username === bot.username)) {
        expect(npcNames).not.toContain(bot.username);
      }
    }
    const stationed = await prisma.base.findMany();
    expect(stationed).toHaveLength(NPC_STATIONS.length);
    expect(new Set(stationed.map((row) => row.sectorId)).size).toBe(NPC_STATIONS.length);
    for (const station of NPC_STATIONS) {
      const card = board.body.npc.find((row: { username: string }) => row.username === station.username);
      expect(card.sectorId).toBe(station.sectorId);
      expect(card.regionName).toBe(station.regionName);
    }
    expect(playerNames).toContain(other.username);
    expect(playerNames).not.toContain(player.username);
    for (const bot of NIGHT_CREW) {
      expect(playerNames).not.toContain(bot.username);
    }

    const boardAgain = await request(app).get("/api/leaderboard").set(auth(player.token));
    const richest = boardAgain.body.richest.map((row: { username: string }) => row.username);
    expect(richest).toContain(player.username);
    expect(richest).toContain(other.username);
    for (const bot of NIGHT_CREW) {
      expect(richest).not.toContain(bot.username);
    }
  });

  it("keeps npc and player targets on separate paths", async () => {
    const player = await registerUser("Gil Crowe");
    const other = await registerUser("Hana Crowe");
    const bot = await createPlayer({
      username: "Night Clerk",
      password: "nightshift",
      isBot: true,
      cash: 4_000,
      vaultBalance: 40_000,
      vaultLevel: 1,
    });

    const board = await request(app).get("/api/heists/targets").set(auth(player.token));
    expect(board.status).toBe(200);
    expect(board.body.npc.map((row: { userId: string }) => row.userId)).not.toContain(bot.id);
    expect(board.body.players.map((row: { userId: string }) => row.userId)).toContain(other.id);
    expect(board.body.players.map((row: { userId: string }) => row.userId)).not.toContain(player.id);
    expect(board.body.players.map((row: { userId: string }) => row.userId)).not.toContain(bot.id);
    expect(board.body.npc.map((row: { userId: string }) => row.userId)).not.toContain(other.id);
    expect(JSON.stringify(board.body)).not.toContain("40000");

    const npcOnPlayer = await request(app)
      .post("/api/heists")
      .set(auth(player.token))
      .send({ targetUserId: bot.id, weaponId: "weapon:0001", kind: "player" });
    expect(npcOnPlayer.status).toBe(400);
    expect(npcOnPlayer.body.code).toBe("WRONG_TARGET_KIND");

    const playerOnNpc = await request(app)
      .post("/api/heists")
      .set(auth(player.token))
      .send({ targetUserId: other.id, weaponId: "weapon:0001", kind: "npc" });
    expect(playerOnNpc.status).toBe(400);
    expect(playerOnNpc.body.code).toBe("WRONG_TARGET_KIND");
    expect(await prisma.heist.count()).toBe(0);
    expect(await userState(other.id)).toMatchObject({ vault: other.vaultBalance });
    expect((await userState(bot.id)).vault).toBe(40_000);

    const stray = await request(app)
      .post("/api/heists")
      .set(auth(player.token))
      .send({ targetUserId: bot.id, weaponId: "weapon:0001", kind: "npc" });
    expect(stray.status).toBe(400);
    expect(stray.body.code).toBe("WRONG_TARGET_KIND");

    const { ensureNightCrew } = await import("../src/services/nightCrew.js");
    await ensureNightCrew();
    const crew = await prisma.user.findUnique({ where: { usernameKey: "mara voss" }, include: { vault: true } });
    expect(crew?.vault).toBeTruthy();
    setHeistRng(() => 1);
    const hit = await request(app)
      .post("/api/heists")
      .set(auth(player.token))
      .send({ targetUserId: crew!.id, weaponId: "weapon:0001", kind: "npc" });
    expect(hit.status).toBe(201);
    expect(hit.body.success).toBe(true);
    expect(hit.body.amountStolen).toBeGreaterThan(0);
    expect((await userState(crew!.id)).vault).toBe(crew!.vault!.balance);
    expect((await userState(player.id)).cash).toBe(player.cash + hit.body.amountStolen);
  });
});

describe("leaderboard", () => {
  it("keeps the existing fields and omits seeded bots", async () => {
    const player = await registerUser("Ivo Crowe");
    const bot = await createPlayer({
      username: "Vault Ghost",
      password: "nightshift",
      isBot: true,
      cash: 9_000_000,
      vaultBalance: 9_000_000,
      vaultLevel: 1,
    });
    await prisma.heist.create({
      data: {
        attackerId: bot.id,
        targetId: player.id,
        weaponId: "weapon:0001",
        weaponLevel: 1,
        vaultLevel: 1,
        successChance: 60,
        success: true,
        amountStolen: 80_000,
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    });

    const res = await request(app).get("/api/leaderboard").set(auth(player.token));
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["assets", "assetsYou", "heisters", "largestHeists", "richest", "you"]);
    expect(res.body.richest.map((row: { username: string }) => row.username)).toContain(player.username);
    expect(res.body.richest.map((row: { username: string }) => row.username)).not.toContain(bot.username);
    expect(res.body.heisters.map((row: { username: string }) => row.username)).not.toContain(bot.username);
    expect(res.body.largestHeists.map((row: { attackerUsername: string }) => row.attackerUsername)).not.toContain(
      bot.username,
    );
  });
});

describe("work board", () => {
  it("lets a level 1 player pick a starter job that pays at noon GMT", async () => {
    const starter = RULES.PASSIVE_JOBS.filter((job) => job.requires.length === 0);
    expect(starter.map((job) => job.id)).toEqual(["volunteer", "mail-man"]);
    expect(starter.map((job) => job.payPerDay)).toEqual([300, 450]);
    for (const job of RULES.PASSIVE_JOBS) {
      if (job.requires.length === 0) expect(job.payPerDay).toBeGreaterThanOrEqual(300);
      else expect(job.payPerDay).toBeGreaterThanOrEqual(3_000);
      expect(job.payPerDay).toBeLessThanOrEqual(job.requires.length === 0 ? 500 : 6_000);
    }
    const sweep = RULES.WORK_CONTRACTS.find((job) => job.id === "street-sweep");
    const drop = RULES.WORK_CONTRACTS.find((job) => job.id === "parcel-drop");
    expect(sweep).toMatchObject({ minLevel: 1, reward: 1_000, durationMinutes: 5 });
    expect(drop).toMatchObject({ minLevel: 1, reward: 1_200, durationMinutes: 10 });

    const player = await registerUser("June Crowe");
    const board = await request(app).get("/api/work/passive").set(auth(player.token));
    expect(board.status).toBe(200);
    const volunteer = board.body.jobs.find((job: { id: string }) => job.id === "volunteer");
    const runner = board.body.jobs.find((job: { id: string }) => job.id === "package-runner");
    expect(volunteer).toMatchObject({ qualified: true, selected: false, payPerDay: 300, requirement: "Reputation level 1" });
    expect(runner.qualified).toBe(false);

    const locked = await request(app).post("/api/work/passive/select").set(auth(player.token)).send({ jobId: "package-runner" });
    expect(locked.status).toBe(403);
    expect(locked.body.code).toBe("NOT_QUALIFIED");

    const picked = await request(app).post("/api/work/passive/select").set(auth(player.token)).send({ jobId: "volunteer" });
    expect(picked.status).toBe(200);
    expect(picked.body).toMatchObject({ jobId: "volunteer", name: "Volunteer", payPerDay: 300, cash: player.cash });

    const beforePay = await request(app).get("/api/me").set(auth(player.token));
    expect(beforePay.body.currentJob).toEqual({ id: "volunteer", name: "Volunteer", payPerDay: 300 });
    expect(beforePay.body.cash).toBe(player.cash);

    await prisma.user.update({
      where: { id: player.id },
      data: { passivePaidFor: new Date("2020-01-01T12:00:00.000Z") },
    });
    const paid = await request(app).get("/api/me").set(auth(player.token));
    expect(paid.body.cash).toBe(player.cash + 300);
    const again = await request(app).get("/api/me").set(auth(player.token));
    expect(again.body.cash).toBe(player.cash + 300);
    expect(
      await prisma.transaction.count({ where: { type: "passive_payday", toUserId: player.id } }),
    ).toBe(1);
  });
});

describe("reputation", () => {
  it("starts at level 1 and pays 50000 when the first rung is claimed", async () => {
    const player = await registerUser("Nell Crowe");
    const opening = await request(app).get("/api/reputation").set(auth(player.token));
    expect(opening.status).toBe(200);
    expect(opening.body.level).toBe(1);
    expect(opening.body.nextLevel).toBe(2);
    expect(opening.body.ready).toBe(false);
    expect(opening.body.conditions.map((row: { label: string }) => row.label)).toEqual([
      "Buy a garage to keep your car",
      "Own your very first car",
      "Find a passive income job",
    ]);

    const early = await request(app).post("/api/reputation/claim").set(auth(player.token)).send({});
    expect(early.status).toBe(400);
    expect(early.body.code).toBe("NOT_READY");

    await prisma.user.update({ where: { id: player.id }, data: { cash: 200_000, passiveJobId: "volunteer" } });
    await prisma.property.createMany({
      data: [
        { userId: player.id, catalogId: "garage", level: 1 },
        { userId: player.id, catalogId: "car", level: 1 },
      ],
    });

    const ready = await request(app).get("/api/reputation").set(auth(player.token));
    expect(ready.body.ready).toBe(true);
    expect(ready.body.reward).toBe(50_000);

    const claimed = await request(app).post("/api/reputation/claim").set(auth(player.token)).send({});
    expect(claimed.status).toBe(200);
    expect(claimed.body.level).toBe(2);
    expect(claimed.body.nextLevel).toBe(3);
    expect(claimed.body.ready).toBe(false);
    expect(claimed.body.cash).toBe(200_000 + 50_000);
    expect(claimed.body.conditions.map((row: { label: string }) => row.label)).toContain(
      "Own a hangar so the aircraft has a home",
    );

    const me = await request(app).get("/api/me").set(auth(player.token));
    expect(me.body.level).toBe(2);
    expect(me.body.title).toBe("City Dweller");

    const again = await request(app).post("/api/reputation/claim").set(auth(player.token)).send({});
    expect(again.status).toBe(400);
    expect(again.body.code).toBe("NOT_READY");
  });
});
