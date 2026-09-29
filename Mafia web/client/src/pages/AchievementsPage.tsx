import { PageTitle } from '../components/ui.tsx'

const FILES = [
  'First job',
  'Quiet exit',
  'Vault door',
  'Named on the book',
  'Coast claimed',
  'Tool upgraded',
]

export function AchievementsPage() {
  return (
    <div className="space-y-4">
      <PageTitle kicker="Record">Criminal record</PageTitle>
      <p className="max-w-xl text-sm text-muted">No achievement file is kept. These slots are locked and do not record progress.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {FILES.map((name) => (
          <article key={name} className="border border-line bg-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-serif text-lg">{name}</h2>
              <span className="text-[10px] tracking-[0.16em] text-muted uppercase">Locked</span>
            </div>
            <p className="mt-4 text-sm text-muted">Progress —</p>
          </article>
        ))}
      </div>
    </div>
  )
}
