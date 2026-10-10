const RARITY: Record<string, string> = {
  'mat:scrap-components': 'common',
  'mat:basic-fasteners': 'common',
  'mat:reinforced-alloy': 'uncommon',
  'mat:precision-parts': 'uncommon',
  'mat:thermal-compound': 'uncommon',
  'mat:conductive-filament': 'rare',
  'mat:adaptive-circuitry': 'rare',
  'mat:composite-weave': 'rare',
  'mat:exotic-core': 'exotic',
  'mat:phase-crystal': 'exotic',
  'mat:predictive-processor': 'exotic',
}

function fileFor(id: string) {
  return `/materials/${id.replace(':', '-')}.png`
}

/** Material symbol from the catalogue strip — icon art only. */
export function MaterialIcon({ id, className = 'h-10 w-10' }: { id: string; className?: string }) {
  return (
    <img
      src={fileFor(id)}
      alt=""
      className={`object-contain ${className}`}
      draggable={false}
    />
  )
}

export function materialRarity(id: string) {
  return RARITY[id] ?? 'common'
}

/** Heist / reward row: icon | NAME rarity | xN (box layout from reference; game fonts). */
export function GainedMaterialRow({
  id,
  name,
  quantity,
}: {
  id: string
  name: string
  quantity: number
}) {
  const rarity = materialRarity(id)
  return (
    <div className="flex items-center gap-3 border border-primary/55 bg-background/40 px-3 py-2.5">
      <MaterialIcon id={id} className="h-11 w-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold uppercase tracking-wide text-foreground">
          {name}{' '}
          <span className="font-mono text-[10px] font-normal tracking-[0.14em] text-muted-foreground">{rarity}</span>
        </p>
      </div>
      <span className="shrink-0 font-mono text-sm tabular-nums text-primary">x{quantity}</span>
    </div>
  )
}
