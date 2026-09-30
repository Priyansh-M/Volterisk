import { CityMap } from '../components/CityMap.tsx'
import { PageTitle } from '../components/ui.tsx'

export function CityPage() {
  return (
    <div>
      <PageTitle kicker="The night grid">City</PageTitle>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Click a building to open that room. Nothing new is happening in the street — these doors lead to the ledger you already keep.
      </p>
      <CityMap />
    </div>
  )
}
