import { Router } from "express";
import { login, logout, register } from "../controllers/authController.js";
import { createHeist, estimate, history, targets } from "../controllers/heistController.js";
import { bases, claim as claimBase } from "../controllers/mapController.js";
import { me, myVault, myWeapons } from "../controllers/meController.js";
import {
  achievementAlerts,
  achievements,
  ackAchievement,
  buyShop,
  cameraUpgrade,
  claimAchievementReward,
  leaderboard,
  notifications,
  readNotification,
  shop,
} from "../controllers/metaController.js";
import { claim as claimStarter } from "../controllers/onboardingController.js";
import { publicPlayer } from "../controllers/playerController.js";
import { upgrade as upgradeVault, withdraw } from "../controllers/vaultController.js";
import { buy, equip, upgrade as upgradeWeapon } from "../controllers/weaponController.js";
import { accept, collect, contracts } from "../controllers/workController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "./asyncHandler.js";

export const api = Router();

api.post("/auth/register", asyncHandler(register));
api.post("/auth/login", asyncHandler(login));
api.post("/auth/logout", requireAuth, asyncHandler(logout));

api.get("/me", requireAuth, asyncHandler(me));
api.get("/me/vault", requireAuth, asyncHandler(myVault));
api.get("/me/weapons", requireAuth, asyncHandler(myWeapons));

api.get("/heists/targets", requireAuth, asyncHandler(targets));
api.post("/heists/estimate", requireAuth, asyncHandler(estimate));
api.post("/heists", requireAuth, asyncHandler(createHeist));
api.get("/heists/history", requireAuth, asyncHandler(history));

api.post("/vault/upgrade", requireAuth, asyncHandler(upgradeVault));
api.post("/vault/withdraw", requireAuth, asyncHandler(withdraw));

api.post("/weapons/buy", requireAuth, asyncHandler(buy));
api.post("/weapons/upgrade", requireAuth, asyncHandler(upgradeWeapon));
api.post("/weapons/equip", requireAuth, asyncHandler(equip));

api.post("/onboarding/claim", requireAuth, asyncHandler(claimStarter));

api.get("/map/bases", requireAuth, asyncHandler(bases));
api.post("/map/base", requireAuth, asyncHandler(claimBase));

api.get("/players/:username/public", requireAuth, asyncHandler(publicPlayer));

api.get("/work/contracts", requireAuth, asyncHandler(contracts));
api.post("/work/contracts/accept", requireAuth, asyncHandler(accept));
api.post("/work/contracts/collect", requireAuth, asyncHandler(collect));

api.get("/leaderboard", requireAuth, asyncHandler(leaderboard));
api.get("/notifications", requireAuth, asyncHandler(notifications));
api.post("/notifications/:id/read", requireAuth, asyncHandler(readNotification));

api.get("/achievements", requireAuth, asyncHandler(achievements));
api.get("/achievements/unannounced", requireAuth, asyncHandler(achievementAlerts));
api.post("/achievements/ack", requireAuth, asyncHandler(ackAchievement));
api.post("/achievements/claim", requireAuth, asyncHandler(claimAchievementReward));

api.get("/shop", requireAuth, asyncHandler(shop));
api.post("/shop/buy", requireAuth, asyncHandler(buyShop));
api.post("/shop/camera/upgrade", requireAuth, asyncHandler(cameraUpgrade));
