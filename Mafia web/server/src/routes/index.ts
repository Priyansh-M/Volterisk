import { Router } from "express";
import { login, logout, register } from "../controllers/authController.js";
import { createHeist, estimate, history, quote, targets } from "../controllers/heistController.js";
import { bases, claim as claimBase, rename as renameBase } from "../controllers/mapController.js";
import { me, myVault, myWeapons, removeAccount, updateAvatar, updateName } from "../controllers/meController.js";
import { bets, exitLobby, invite, join, lobby, openLobby, players, spin, table, tableSpin } from "../controllers/casinoController.js";
import {
  achievementAlerts,
  achievements,
  ackAchievement,
  buyPropertyHandler,
  upgradePropertyHandler,
  buyShop,
  cameraUpgrade,
  claimAchievementReward,
  community,
  leaderboard,
  notifications,
  properties,
  readNotification,
  shop,
} from "../controllers/metaController.js";
import { claim as claimStarter } from "../controllers/onboardingController.js";
import { publicPlayer } from "../controllers/playerController.js";
import { deposit, insurance, upgrade as upgradeVault, withdraw } from "../controllers/vaultController.js";
import { buy, equip, upgrade as upgradeWeapon } from "../controllers/weaponController.js";
import { claimReputationLevel, reputation } from "../controllers/reputationController.js";
import { accept, collect, collectPassivePay, contracts, passive } from "../controllers/workController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "./asyncHandler.js";

export const api = Router();

api.post("/auth/register", asyncHandler(register));
api.post("/auth/login", asyncHandler(login));
api.post("/auth/logout", requireAuth, asyncHandler(logout));

api.get("/me", requireAuth, asyncHandler(me));
api.post("/me/avatar", requireAuth, asyncHandler(updateAvatar));
api.post("/me/name", requireAuth, asyncHandler(updateName));
api.delete("/me", requireAuth, asyncHandler(removeAccount));
api.get("/casino/roulette", requireAuth, asyncHandler(table));
api.post("/casino/roulette", requireAuth, asyncHandler(spin));
api.get("/players/search", requireAuth, asyncHandler(players));
api.post("/casino/lobby", requireAuth, asyncHandler(openLobby));
api.get("/casino/lobby/:id", requireAuth, asyncHandler(lobby));
api.post("/casino/lobby/:id/invite", requireAuth, asyncHandler(invite));
api.post("/casino/lobby/:id/join", requireAuth, asyncHandler(join));
api.post("/casino/lobby/:id/bets", requireAuth, asyncHandler(bets));
api.post("/casino/lobby/:id/spin", requireAuth, asyncHandler(tableSpin));
api.post("/casino/lobby/:id/leave", requireAuth, asyncHandler(exitLobby));
api.get("/me/vault", requireAuth, asyncHandler(myVault));
api.get("/me/weapons", requireAuth, asyncHandler(myWeapons));

api.get("/heists/targets", requireAuth, asyncHandler(targets));
api.post("/heists/estimate", requireAuth, asyncHandler(estimate));
api.post("/heists/quote", requireAuth, asyncHandler(quote));
api.post("/heists", requireAuth, asyncHandler(createHeist));
api.get("/heists/history", requireAuth, asyncHandler(history));

api.post("/vault/upgrade", requireAuth, asyncHandler(upgradeVault));
api.post("/vault/insurance", requireAuth, asyncHandler(insurance));
api.post("/vault/withdraw", requireAuth, asyncHandler(withdraw));
api.post("/vault/deposit", requireAuth, asyncHandler(deposit));

api.post("/weapons/buy", requireAuth, asyncHandler(buy));
api.post("/weapons/upgrade", requireAuth, asyncHandler(upgradeWeapon));
api.post("/weapons/equip", requireAuth, asyncHandler(equip));

api.post("/onboarding/claim", requireAuth, asyncHandler(claimStarter));

api.get("/map/bases", requireAuth, asyncHandler(bases));
api.post("/map/base", requireAuth, asyncHandler(claimBase));
api.post("/map/base/name", requireAuth, asyncHandler(renameBase));

api.get("/players/:username/public", requireAuth, asyncHandler(publicPlayer));

api.get("/work/contracts", requireAuth, asyncHandler(contracts));
api.post("/work/contracts/accept", requireAuth, asyncHandler(accept));
api.post("/work/contracts/collect", requireAuth, asyncHandler(collect));
api.get("/reputation", requireAuth, asyncHandler(reputation));
api.post("/reputation/claim", requireAuth, asyncHandler(claimReputationLevel));

api.get("/work/passive", requireAuth, asyncHandler(passive));
api.post("/work/passive/select", requireAuth, asyncHandler(collectPassivePay));

api.get("/leaderboard", requireAuth, asyncHandler(leaderboard));
api.get("/community", requireAuth, asyncHandler(community));
api.get("/notifications", requireAuth, asyncHandler(notifications));
api.post("/notifications/:id/read", requireAuth, asyncHandler(readNotification));

api.get("/achievements", requireAuth, asyncHandler(achievements));
api.get("/achievements/unannounced", requireAuth, asyncHandler(achievementAlerts));
api.post("/achievements/ack", requireAuth, asyncHandler(ackAchievement));
api.post("/achievements/claim", requireAuth, asyncHandler(claimAchievementReward));

api.get("/properties", requireAuth, asyncHandler(properties));
api.post("/properties/buy", requireAuth, asyncHandler(buyPropertyHandler));
api.post("/properties/upgrade", requireAuth, asyncHandler(upgradePropertyHandler));

api.get("/shop", requireAuth, asyncHandler(shop));
api.post("/shop/buy", requireAuth, asyncHandler(buyShop));
api.post("/shop/camera/upgrade", requireAuth, asyncHandler(cameraUpgrade));
