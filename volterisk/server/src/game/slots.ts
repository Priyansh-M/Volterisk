export type SlotSymbol =
  | "cherry"
  | "lemon"
  | "plum"
  | "grape"
  | "bell"
  | "seven"
  | "bar"
  | "bar2"
  | "bar3"
  | "star"
  | "diamond"
  | "coin"
  | "card"
  | "vault"
  | "crown";

export type SlotMachine = {
  id: string;
  name: string;
  tag: string;
  reel: [SlotSymbol, number][];
  three: Partial<Record<SlotSymbol, number>>;
  two: Partial<Record<SlotSymbol, number>>;
  one: Partial<Record<SlotSymbol, number>>;
  combos: { id: string; mult: number; label: string; test: (a: SlotSymbol[]) => boolean }[];
};

function same(a: SlotSymbol[]) {
  return a[0] === a[1] && a[1] === a[2];
}
function allIn(a: SlotSymbol[], set: SlotSymbol[]) {
  return a.every((x) => set.includes(x));
}
function countMap(a: SlotSymbol[]) {
  const m: Partial<Record<SlotSymbol, number>> = {};
  for (const x of a) m[x] = (m[x] ?? 0) + 1;
  return m;
}

export const SLOT_MACHINES: SlotMachine[] = [
  {
    id: "fruit",
    name: "Fruit Classic",
    tag: "Low risk · frequent wins",
    reel: [
      ["cherry", 9],
      ["lemon", 8],
      ["plum", 7],
      ["grape", 6],
      ["bell", 4],
      ["seven", 2],
    ],
    three: { cherry: 5, lemon: 8, plum: 10, grape: 15, bell: 25, seven: 50 },
    two: { cherry: 2 },
    one: { cherry: 0.5 },
    combos: [
      {
        id: "salad",
        mult: 3,
        label: "Fruit Salad",
        test: (a) => allIn(a, ["cherry", "lemon", "plum", "grape"]) && !same(a),
      },
    ],
  },
  {
    id: "sevens",
    name: "Lucky Sevens",
    tag: "High risk · big jackpot",
    reel: [
      ["bar", 9],
      ["bar2", 7],
      ["bar3", 5],
      ["star", 5],
      ["diamond", 3],
      ["seven", 2],
    ],
    three: { bar: 10, bar2: 20, bar3: 40, star: 60, diamond: 100, seven: 250 },
    two: { seven: 5, diamond: 3 },
    one: {},
    combos: [
      {
        id: "bars",
        mult: 4,
        label: "Mixed Bars",
        test: (a) => a.every((x) => x.startsWith("bar")) && !same(a),
      },
    ],
  },
  {
    id: "vault",
    name: "Diamond Vault",
    tag: "Premium · mega jackpot",
    reel: [
      ["coin", 9],
      ["card", 7],
      ["vault", 6],
      ["crown", 4],
      ["diamond", 3],
      ["seven", 2],
    ],
    three: { coin: 8, card: 12, vault: 20, crown: 40, diamond: 120, seven: 300 },
    two: { diamond: 5, vault: 2 },
    one: {},
    combos: [
      {
        id: "portfolio",
        mult: 4,
        label: "Full Portfolio",
        test: (a) => allIn(a, ["coin", "card", "vault"]) && !same(a),
      },
    ],
  },
];

export function slotMachine(id: string) {
  return SLOT_MACHINES.find((row) => row.id === id) ?? null;
}

export function prettySlot(s: string) {
  return ({ bar: "Bar", bar2: "Double Bar", bar3: "Triple Bar" } as Record<string, string>)[s]
    ?? s.charAt(0).toUpperCase() + s.slice(1);
}

/** Pay lines above 20% hit rate. 15% of those hits become no-pay. */
const SOFT_PAY = new Set(["Fruit Salad", "Mixed Bars", "Full Portfolio"]);

export function evaluateSlots(m: SlotMachine, a: SlotSymbol[]) {
  let best: { mult: number; label: string } | null = null;
  const consider = (mult: number, label: string) => {
    if (mult > 0 && (!best || mult > best.mult)) best = { mult, label };
  };
  if (same(a)) {
    const s = a[0];
    if (m.three[s]) consider(m.three[s]!, `Three ${prettySlot(s)}`);
  }
  for (const c of m.combos) {
    if (c.test(a)) consider(c.mult, c.label);
  }
  const cm = countMap(a);
  for (const s of Object.keys(m.two) as SlotSymbol[]) {
    if (cm[s] === 2) consider(m.two[s]!, `Two ${prettySlot(s)}`);
  }
  for (const s of Object.keys(m.one) as SlotSymbol[]) {
    const n = cm[s] ?? 0;
    if (n >= 1 && n < 2) consider(m.one[s]!, `One ${prettySlot(s)}`);
  }
  return best;
}

export function pickWeighted(reel: [SlotSymbol, number][], n: number) {
  let r = n;
  for (const [id, w] of reel) {
    r -= w;
    if (r < 0) return id;
  }
  return reel[reel.length - 1][0];
}

function drawReels(m: SlotMachine, rand: (max: number) => number): SlotSymbol[] {
  const w = reelWeight(m.reel);
  return [0, 1, 2].map(() => pickWeighted(m.reel, rand(w)));
}

export function spinReels(m: SlotMachine, rand: (max: number) => number) {
  let reels = drawReels(m, rand);
  let win = evaluateSlots(m, reels);
  if (win && SOFT_PAY.has(win.label) && rand(100) < 15) {
    for (let i = 0; i < 24 && win; i++) {
      reels = drawReels(m, rand);
      win = evaluateSlots(m, reels);
    }
    if (win) win = null;
  }
  return { reels, win };
}

export function reelWeight(reel: [SlotSymbol, number][]) {
  return reel.reduce((s, [, w]) => s + w, 0);
}
