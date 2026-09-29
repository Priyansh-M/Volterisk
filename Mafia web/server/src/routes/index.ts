import { Router } from "express";
import { login, logout, register } from "../controllers/authController.js";
import { createHeist, history, preview, targets } from "../controllers/heistController.js";
import { me, myVault, myWeapons } from "../controllers/meController.js";
import { leaderboard, notifications } from "../controllers/metaController.js";
import { upgrade as upgradeVault, withdraw } from "../controllers/vaultController.js";
import { buy, equip, upgrade as upgradeWeapon } from "../controllers/weaponController.js";
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
api.get("/heists/preview", requireAuth, asyncHandler(preview));
api.post("/heists", requireAuth, asyncHandler(createHeist));
api.get("/heists/history", requireAuth, asyncHandler(history));

api.post("/vault/upgrade", requireAuth, asyncHandler(upgradeVault));
api.post("/vault/withdraw", requireAuth, asyncHandler(withdraw));

api.post("/weapons/buy", requireAuth, asyncHandler(buy));
api.post("/weapons/upgrade", requireAuth, asyncHandler(upgradeWeapon));
api.post("/weapons/equip", requireAuth, asyncHandler(equip));

api.get("/leaderboard", requireAuth, asyncHandler(leaderboard));
api.get("/notifications", requireAuth, asyncHandler(notifications));
