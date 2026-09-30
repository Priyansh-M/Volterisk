import { GameError } from "../game/errors.js";
import { RULES } from "../game/rules.js";
import { prisma } from "../prisma.js";
import { toPublicCard, loadPublicProfiles } from "./publicProfileService.js";
import { uniqueConflictText, withSqliteRetry } from "./sqlite.js";

export type BaseClaim = {
  sectorId: string;
  landmassId: string;
  regionName: string;
  name?: string | null;
};

export type BaseView = {
  sectorId: string;
  landmassId: string;
  regionName: string;
  name: string | null;
};

function cleanClaim(input: BaseClaim): BaseView {
  const sectorId = input.sectorId.trim().toLowerCase();
  const landmassId = input.landmassId.trim().toLowerCase();
  const regionName = input.regionName.trim();
  if (!RULES.SECTOR_ID_PATTERN.test(sectorId) || sectorId.length > RULES.SECTOR_ID_MAX_LENGTH) {
    throw new GameError(400, "VALIDATION", "That sector id is not a map slug.");
  }
  if (!RULES.SECTOR_ID_PATTERN.test(landmassId) || landmassId.length > RULES.LANDMASS_ID_MAX_LENGTH) {
    throw new GameError(400, "VALIDATION", "That landmass id is not a map slug.");
  }
  if (regionName.length < 1 || regionName.length > RULES.REGION_NAME_MAX_LENGTH) {
    throw new GameError(400, "VALIDATION", "Region name is missing.");
  }
  const name = cleanBlockName(input.name);
  return { sectorId, landmassId, regionName, name };
}

export function cleanBlockName(value: string | null | undefined): string | null {
  if (value == null) return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return null;
  if (name.length > 32) {
    throw new GameError(400, "VALIDATION", "Block name can be 32 characters at most.");
  }
  return name;
}

function occupied(): GameError {
  return new GameError(409, "SECTOR_OCCUPIED", "That sector is already claimed.");
}

function alreadyBased(): GameError {
  return new GameError(409, "ALREADY_HAS_BASE", "You already have a base.");
}

/**
 * Claim one sector. userId and sectorId are each unique, so a second base for
 * the same player and a second claim of the same sector both fail closed.
 */
export async function claimBase(userId: string, input: BaseClaim): Promise<{ base: BaseView }> {
  const claim = cleanClaim(input);
  const base = await withSqliteRetry(() =>
    prisma.$transaction(async (tx) => {
      const mine = await tx.base.findUnique({ where: { userId } });
      if (mine) throw alreadyBased();
      const taken = await tx.base.findUnique({ where: { sectorId: claim.sectorId } });
      if (taken) throw occupied();
      try {
        return await tx.base.create({
          data: {
            userId,
            sectorId: claim.sectorId,
            landmassId: claim.landmassId,
            regionName: claim.regionName,
            name: claim.name,
          },
        });
      } catch (error) {
        const hint = uniqueConflictText(error);
        if (hint?.includes("sector")) throw occupied();
        if (hint?.includes("user")) throw alreadyBased();
        throw error;
      }
    }),
  );
  return {
    base: {
      sectorId: base.sectorId,
      landmassId: base.landmassId,
      regionName: base.regionName,
      name: base.name,
    },
  };
}

export async function renameBase(userId: string, name: string | null) {
  const cleaned = cleanBlockName(name);
  const base = await prisma.base.findUnique({ where: { userId } });
  if (!base) throw new GameError(404, "NO_BASE", "You do not have a block yet.");
  const updated = await prisma.base.update({ where: { userId }, data: { name: cleaned } });
  return {
    sectorId: updated.sectorId,
    landmassId: updated.landmassId,
    regionName: updated.regionName,
    name: updated.name,
  };
}

export async function listBases(viewerId: string) {
  const [bases, profiles] = await Promise.all([
    prisma.base.findMany({
      orderBy: { createdAt: "asc" },
      include: { user: { select: { username: true, isBot: true } } },
    }),
    loadPublicProfiles(),
  ]);
  return {
    bases: bases.flatMap((base) => {
      if (!base.user) return [];
      const profile = profiles.get(base.userId);
      return [
        {
          sectorId: base.sectorId,
          landmassId: base.landmassId,
          regionName: base.regionName,
          name: base.name,
          isYou: base.userId === viewerId,
          isNpc: base.user.isBot,
          player: profile
            ? toPublicCard(profile)
            : {
                username: base.user.username,
                title: "",
                level: 0,
                rank: 0,
                estimatedWealth: "—",
                properties: 0,
                weapons: 0,
                successfulHeists: 0,
              },
        },
      ];
    }),
  };
}
