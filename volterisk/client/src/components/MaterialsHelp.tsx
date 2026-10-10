import { useState } from 'react'
import { MaterialIcon } from './MaterialIcon.tsx'

const MATERIALS: {
  id: string
  name: string
  rarity: string
  how: string[]
}[] = [
  {
    id: 'mat:scrap-components',
    name: 'Scrap Components',
    rarity: 'common',
    how: [
      'Work → collect a contract that paid under $15,000 → always get ×3',
      'Heists → succeed any heist → ~55% chance of ×2',
      'Manufacturing Plant at 12:00 GMT → L1 ×3; L2 ×5; L3+ ×10 (Required property level of Manufacturing Plant)',
      'Black Market → buy a Scrap Components listing',
    ],
  },
  {
    id: 'mat:basic-fasteners',
    name: 'Basic Fasteners',
    rarity: 'common',
    how: [
      'Heists → succeed with take ≥ $8,000 → ~40% chance of ×2',
      'Manufacturing Plant at 12:00 GMT → L2 ×3; L3+ ×6 (Required property level of Manufacturing Plant)',
      'Black Market → buy a Basic Fasteners listing',
    ],
  },
  {
    id: 'mat:reinforced-alloy',
    name: 'Reinforced Alloy',
    rarity: 'uncommon',
    how: [
      'Work → collect a contract that paid $15,000–$49,999 → always get ×2',
      'Heists → succeed with take ≥ $25,000 → ~35% chance of ×1',
      'Manufacturing Plant at 12:00 GMT → L2 ×1; L3+ ×2 (Required property level of Manufacturing Plant)',
      'Black Market → buy a Reinforced Alloy listing',
    ],
  },
  {
    id: 'mat:precision-parts',
    name: 'Precision Parts',
    rarity: 'uncommon',
    how: [
      'Heists → succeed with take ≥ $60,000 → ~28% chance of ×1',
      'Manufacturing Plant at 12:00 GMT → L2 ×1; L3+ ×2 (Required property level of Manufacturing Plant)',
      'Black Market → buy a Precision Parts listing',
    ],
  },
  {
    id: 'mat:thermal-compound',
    name: 'Thermal Compound',
    rarity: 'uncommon',
    how: [
      'Own a Warehouse at level 4+ (buy/upgrade under Assets)',
      'Every day at 12:00 GMT → auto-credit: L4 = ×1, L5+ = ×2 into Materials + a notification',
      'Black Market → buy a Thermal Compound listing',
    ],
  },
  {
    id: 'mat:conductive-filament',
    name: 'Conductive Filament',
    rarity: 'rare',
    how: [
      'Work → collect a contract that paid $50,000+ → always get ×1',
      'Heists → succeed with take ≥ $120,000 → ~20% chance of ×1',
      'Manufacturing Plant at 12:00 GMT → L4+ ×1 (Required property level of Manufacturing Plant)',
      'Black Market → buy a Conductive Filament listing',
    ],
  },
  {
    id: 'mat:adaptive-circuitry',
    name: 'Adaptive Circuitry',
    rarity: 'rare',
    how: [
      'Elite activities (see list below)',
      'Manufacturing Plant at 12:00 GMT → L5 ×1 (Required property level of Manufacturing Plant)',
      'Black Market → buy an Adaptive Circuitry listing',
    ],
  },
  {
    id: 'mat:composite-weave',
    name: 'Composite Weave',
    rarity: 'rare',
    how: [
      'Own a Garage (any level 1+)',
      'Every day at 12:00 GMT → auto-credit ×garage level (L1 = ×1, L2 = ×2, …) into Materials + a notification',
      'Heists → succeed with take ≥ $250,000 → ~12% chance of ×1',
      'Black Market → buy a Composite Weave listing',
    ],
  },
  {
    id: 'mat:exotic-core',
    name: 'Exotic Core',
    rarity: 'exotic',
    how: [
      'Own a Chop Shop at level 5+ (buy/upgrade under Assets)',
      'Every day at 12:00 GMT → ×1 at L5, scaling evenly to ×5 at L20 (Required property level of Chop Shop)',
      'Elite activities (see list below)',
      'Black Market → buy an Exotic Core listing',
    ],
  },
  {
    id: 'mat:phase-crystal',
    name: 'Phase Crystal',
    rarity: 'exotic',
    how: ['Elite activities (see list below)', 'Black Market → buy a Phase Crystal listing'],
  },
  {
    id: 'mat:predictive-processor',
    name: 'Predictive Processor',
    rarity: 'exotic',
    how: ['Elite activities (see list below)', 'Black Market → buy a Predictive Processor listing'],
  },
]

const ELITE_ACTIVITIES = [
  'Work contracts that pay $50,000+ on collect (top band on the board)',
  'Successful heists with large takes ($120,000+; $250,000+ for composite weave chance)',
  'Reputation milestones / sealed achievements when they credit exotic mats',
  'Daily property yields at 12:00 GMT (chop shop → Exotic Core; garage → Composite Weave; manufacturing plant → parts ladder)',
  'Late-game after Reputation level 11 (territory expansion, Diamond vault play)',
] as const

/** Help control — top-left of materials / workshop surfaces. */
export function MaterialsHelp() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 text-left text-xs font-mono uppercase tracking-[0.14em] text-primary hover:border-primary"
        onClick={() => setOpen(true)}
      >
        <span className="flex h-5 w-5 items-center justify-center border border-primary text-[11px]">?</span>
        Materials
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-background/80 p-4 pt-16 sm:justify-start sm:pl-8">
          <section className="flex max-h-[80vh] w-full max-w-xl flex-col border border-primary bg-card shadow-2xl">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Field guide</p>
                <h2 className="font-display text-2xl font-semibold uppercase">Materials</h2>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center border border-border text-lg leading-none hover:border-primary"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="overflow-y-auto px-4 py-4 text-sm leading-relaxed text-muted-foreground">
              <p className="mb-4 text-foreground">
                Materials are crafting items. Open <span className="text-primary">Finances → Workshop</span> to spend them on
                mods, or <span className="text-primary">Assets → Materials</span> to see your stock. They are not cash.
              </p>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Four ways to get materials</p>
              <ol className="mb-4 list-decimal space-y-2 pl-5 text-xs">
                <li>
                  <span className="text-foreground">Work contracts</span> — finish a job on Work, then Collect. Payout size
                  picks the mat: under $15k = Scrap ×3; $15k–$49,999 = Alloy ×2; $50k+ = Conductive Filament ×1. Jobs paying
                  $18k+ also have a 12% chance to drop a blueprint.
                </li>
                <li>
                  <span className="text-foreground">Heists</span> — succeed a heist; larger take = better chance rolls (exact
                  thresholds under each material below).
                </li>
                <li>
                  <span className="text-foreground">Property deliveries at 12:00 GMT</span> — own the building, wait for noon
                  GMT; mats land in Materials automatically with a notification (chop shop, garage, warehouse,
                  manufacturing plant).
                </li>
                <li>
                  <span className="text-foreground">Black Market</span> — buy another player’s listing (Finances → Black
                  Market).
                </li>
              </ol>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Elite activities</p>
              <p className="mb-2 text-xs">
                If a material says <span className="text-foreground">elite activities</span>, get it from one of these:
              </p>
              <ul className="mb-4 list-disc space-y-1 pl-5 text-xs">
                {ELITE_ACTIVITIES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                Each material — how to get it
              </p>
              <ul className="space-y-4">
                {MATERIALS.map((m) => (
                  <li key={m.id} className="flex gap-3 border-b border-border pb-4">
                    <MaterialIcon id={m.id} className="mt-0.5 h-12 w-12 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {m.name}{' '}
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">{m.rarity}</span>
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">How to get it</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                        {m.how.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
