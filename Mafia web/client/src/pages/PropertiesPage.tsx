import { PageTitle } from '../components/ui.tsx'

const LOTS = [
  { name: 'Safehouse', note: 'A room with a second exit.' },
  { name: 'Warehouse', note: 'Floor space and a quiet dock.' },
  { name: 'Front', note: 'A counter that faces the street.' },
  { name: 'Mooring', note: 'Water access, no ledger.' },
  { name: 'Club', note: 'A door that stays unmarked.' },
]

export function PropertiesPage() {
  return (
    <div className="space-y-4">
      <PageTitle kicker="Holdings">Property network</PageTitle>
      <p className="max-w-xl text-sm text-muted">No property market is open. Nothing here is owned, and nothing here pays.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {LOTS.map((lot) => (
          <article key={lot.name} className="border border-line bg-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-serif text-xl">{lot.name}</h2>
              <span className="text-[10px] tracking-[0.16em] text-muted uppercase">Locked</span>
            </div>
            <p className="mt-2 text-sm text-muted">{lot.note}</p>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Owned</dt>
                <dd>—</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Income</dt>
                <dd>—</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
