import { RULES } from "../src/game/rules.ts";
import { ASSETS, assetUpgradeCost } from "../src/services/propertyService.ts";

const price = Object.fromEntries(ASSETS.map((a) => [a.id, a.price]));
const name = Object.fromEntries(ASSETS.map((a) => [a.id, a.name]));
const have: Record<string, number> = {};

function ensure(id: string, level: number) {
  const lines: [string, string, number][] = [];
  if ((have[id] ?? 0) === 0 && level >= 1) {
    lines.push([name[id] ?? id, "buy", price[id] ?? 0]);
    have[id] = 1;
  }
  while ((have[id] ?? 0) < level) {
    const cost = assetUpgradeCost(price[id] ?? 0, have[id]!, id) ?? 0;
    lines.push([name[id] ?? id, `L${have[id]}→L${have[id]! + 1}`, cost]);
    have[id] = (have[id] ?? 0) + 1;
  }
  return lines;
}

for (const rung of RULES.REPUTATION) {
  if (rung.level > 9) break;
  for (const c of rung.conditions) {
    if (c.kind === "asset") ensure(c.id, c.minLevel);
  }
}

for (const rung of RULES.REPUTATION) {
  if (rung.level < 10) continue;
  const lines: [string, string, number][] = [];
  if (rung.fee) lines.push(["Reputation fee", "fee", rung.fee]);
  for (const c of rung.conditions) {
    if (c.kind === "asset") lines.push(...ensure(c.id, c.minLevel));
  }
  const sum = lines.reduce((n, row) => n + row[2], 0);
  if (!lines.length) continue;
  console.log(`TO L${rung.level}\t${sum}`);
  for (const [a, b, c] of lines) console.log(`\t${a}\t${b}\t${c}`);
}
