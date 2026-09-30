import { useNavigate } from 'react-router-dom'
import { LANDMASSES, SECTORS, WORLD } from '../lib/world.ts'

const island = LANDMASSES[0]

export function HomePage() {
  const navigate = useNavigate()
  const points = island.polygon.map(([x, y]) => `${x},${y}`).join(' ')
  return (
    <div className="classified-grid min-h-screen text-foreground">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 md:px-8">
        <p className="font-display text-xl font-semibold tracking-[0.18em]">VOLTERISK</p>
        <p className="hidden font-mono text-[10px] tracking-[0.2em] text-muted uppercase sm:block">Classified · Operation file 001</p>
      </header>
      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-16">
        <section>
          <p className="font-mono text-[11px] tracking-[0.22em] text-primary uppercase">A vault, a crew, and a chart</p>
          <h1 className="mt-4 font-display text-5xl leading-[0.9] font-semibold uppercase md:text-7xl">
            Every square has a price.
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
            Volterisk drops you on one island with a crowbar and a thin vault. Claim a square, take work, and rob the crews who already live there. Heat climbs when you steal. Pocket cash is what the police can take.
          </p>
          <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2">
            <Brief kicker="Territory" body="Claim one square on the Volterisk chart. That square is your block." />
            <Brief kicker="Heists" body="Hit stationed crews and other players. The server rolls the chance. You do not." />
            <Brief kicker="Vault" body="Cash in your pocket can be seized. Cash in the vault has a door, a cap, and insurance." />
            <Brief kicker="Reputation" body="Levels 1 to 10. Work, titles, and the harder crews follow that number." />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="gloss-gold cursor-pointer px-6 py-3 text-sm font-semibold tracking-[0.14em] uppercase"
              onClick={() => navigate('/login')}
            >
              Next →
            </button>
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted uppercase">Sign in or open a new file</p>
          </div>
        </section>
        <aside className="border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase">Volterisk sector survey</p>
            <p className="font-mono text-[10px] text-primary">Live</p>
          </div>
          <svg viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} className="h-[420px] w-full bg-background" role="img" aria-label="Volterisk island">
            <polygon points={points} fill="oklch(0.2 0.02 75)" stroke="oklch(0.69 0.105 82)" strokeWidth="2" />
            {island.regions.map((region) => (
              <text key={region.name} x={region.x} y={region.y} textAnchor="middle" className="fill-muted" fontSize="14">
                {region.name.toUpperCase()}
              </text>
            ))}
          </svg>
          <div className="grid grid-cols-3 border-t border-border text-center">
            <Stat label="Landmass" value="01" />
            <Stat label="Tracked sectors" value={String(SECTORS.length)} />
            <Stat label="Regions" value="05" />
          </div>
        </aside>
      </main>
    </div>
  )
}

function Brief({ kicker, body }: { kicker: string; body: string }) {
  return (
    <article className="bg-card p-4">
      <p className="font-mono text-[10px] tracking-[0.18em] text-primary uppercase">{kicker}</p>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{body}</p>
    </article>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3">
      <p className="font-mono text-[9px] tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl text-primary">{value}</p>
    </div>
  )
}
