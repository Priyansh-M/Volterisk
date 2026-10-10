import { CRAFT_RECIPES, MATERIALS, materialById } from "../game/workshopEconomy.js";
import { GameError } from "../game/errors.js";
import { listInventory } from "./inventoryService.js";
import { ensureWorkshop } from "./workshopService.js";

export async function listMaterials(userId: string) {
  await ensureWorkshop(userId);
  const inv = await listInventory(userId);
  const qty = new Map(inv.map((r) => [r.itemId, r.quantity]));
  const materials = MATERIALS.map((m) => {
    const usedIn = CRAFT_RECIPES.filter((r) => (r.materials[m.id] ?? 0) > 0).map((r) => ({
      recipeId: r.id,
      name: r.name,
      amount: r.materials[m.id] ?? 0,
    }));
    return {
      id: m.id,
      name: m.name,
      rarity: m.rarity,
      refPrice: m.refPrice,
      quantity: qty.get(m.id) ?? 0,
      sources: m.sources,
      recipes: usedIn,
      description: `${m.rarity} crafting material.`,
    };
  });
  return { materials };
}

export async function getMaterial(userId: string, materialId: string) {
  const list = await listMaterials(userId);
  const row = list.materials.find((m) => m.id === materialId);
  if (!row || !materialById(materialId)) throw new GameError(404, "NOT_FOUND", "Unknown material.");
  return row;
}
