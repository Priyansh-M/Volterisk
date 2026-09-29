/**
 * Every achievement in the game. Evaluation is pure: a snapshot of the
 * player's own server-side counters decides what is earned, so nothing here
 * can be triggered by a client claim.
 */
export type AchievementSnapshot = {
  successfulHeists: number;
  failedHeists: number;
  largestHeist: number;
  vaultLevel: number;
  hasBase: boolean;
  contractsCompleted: number;
  properties: number;
  weapons: number;
  netWorth: number;
};

export type AchievementDefinition = {
  id: string;
  name: string;
  description: string;
  /** Secret achievements expose only a hint until they are earned. */
  secret: boolean;
  hint?: string;
  earned: (snapshot: AchievementSnapshot) => boolean;
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first-score",
    name: "First Score",
    description: "Walk away from a vault with someone else's money.",
    secret: false,
    earned: (s) => s.successfulHeists >= 1,
  },
  {
    id: "repeat-offender",
    name: "Repeat Offender",
    description: "Pull off five successful heists.",
    secret: false,
    earned: (s) => s.successfulHeists >= 5,
  },
  {
    id: "reinforced",
    name: "Reinforced",
    description: "Upgrade your vault for the first time.",
    secret: false,
    earned: (s) => s.vaultLevel >= 2,
  },
  {
    id: "flag-planted",
    name: "Flag Planted",
    description: "Claim a sector and establish a base of operations.",
    secret: false,
    earned: (s) => s.hasBase,
  },
  {
    id: "on-the-books",
    name: "On The Books",
    description: "Finish a contract from the work board.",
    secret: false,
    earned: (s) => s.contractsCompleted >= 1,
  },
  {
    id: "steady-earner",
    name: "Steady Earner",
    description: "Finish ten contracts.",
    secret: false,
    earned: (s) => s.contractsCompleted >= 10,
  },
  {
    id: "landlord",
    name: "Landlord",
    description: "Own three properties at once.",
    secret: false,
    earned: (s) => s.properties >= 3,
  },
  {
    id: "well-armed",
    name: "Well Armed",
    description: "Keep three weapons in your arsenal.",
    secret: false,
    earned: (s) => s.weapons >= 3,
  },
  {
    id: "six-figures",
    name: "Six Figures",
    description: "Hold $100,000 across cash and vault.",
    secret: false,
    earned: (s) => s.netWorth >= 100_000,
  },
  {
    id: "half-a-million",
    name: "Half A Million",
    description: "Hold $500,000 across cash and vault.",
    secret: false,
    earned: (s) => s.netWorth >= 500_000,
  },
  {
    id: "millionaire",
    name: "Millionaire",
    description: "Hold $1,000,000 across cash and vault.",
    secret: false,
    earned: (s) => s.netWorth >= 1_000_000,
  },
  {
    id: "ghost-shift",
    name: "Ghost Shift",
    description: "Finish ten contracts without ever failing a heist.",
    secret: true,
    hint: "Ten clean jobs, no botched doors.",
    earned: (s) => s.contractsCompleted >= 10 && s.failedHeists === 0,
  },
  {
    id: "one-big-night",
    name: "One Big Night",
    description: "Take $50,000 or more from a single vault.",
    secret: true,
    hint: "One door, a very heavy bag.",
    earned: (s) => s.largestHeist >= 50_000,
  },
  {
    id: "learned-the-hard-way",
    name: "Learned The Hard Way",
    description: "Fail a job, then come back and land one.",
    secret: true,
    hint: "The second attempt is the one that counts.",
    earned: (s) => s.failedHeists >= 1 && s.successfulHeists >= 1,
  },
];

export function achievementById(id: string): AchievementDefinition | null {
  return ACHIEVEMENTS.find((entry) => entry.id === id) ?? null;
}
