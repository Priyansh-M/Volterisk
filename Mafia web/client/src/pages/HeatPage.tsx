import { PageTitle } from '../components/ui.tsx'
import { useAuth } from '../lib/auth.tsx'

const rows = [
  ['Successful heist', '+8'],
  ['Failed heist', '+15'],
  ['High-value heist, $50,000 or more taken', '+12'],
  ['Collect an active job', '−10'],
  ['Passive job payday', '−6'],
  ['Every 2 hours, whether you are online or not', '−5'],
]

export function HeatPage() {
  const { me } = useAuth()
  const heat = me?.heat ?? 0
  return (
    <div className="space-y-4">
      <PageTitle kicker="Exposure">Heat</PageTitle>
      <section className="border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">On your file</p>
        <p className="mt-2 font-display text-6xl font-semibold">{heat}</p>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Heat is the balance between crime and work. Heists raise it. Jobs and time bring it down. It never falls below zero.
        </p>
      </section>
      <section className="border border-border bg-card">
        <p className="border-b border-border px-4 py-3 text-sm">Heat changes from what you do:</p>
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 text-right font-medium">Heat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([action, value]) => (
              <tr key={action} className="border-t border-border">
                <td className="px-4 py-3">{action}</td>
                <td className="px-4 py-3 text-right font-mono">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="border border-destructive/40 bg-card p-5 text-sm text-muted-foreground">
        At midnight GMT, if heat is still above 50, there is a 95% chance the police confiscate the cash in your pocket. The vault is not touched. A high-value heist is one that takes $50,000 or more, and that +12 replaces the usual +8. A failed heist is +15.
      </section>
    </div>
  )
}
