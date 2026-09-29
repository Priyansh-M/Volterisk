import { useEffect, useState } from 'react'
import { Btn, Notice } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

type CatalogItem = { id: string; name: string; price: number; note: string; owned: boolean }

export function PropertiesPage() {
  const { me, refresh } = useAuth()
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const data = await api<{ catalog: CatalogItem[] }>('/api/properties')
    setCatalog(data.catalog)
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'The property desk is shut.'))
  }, [])

  async function buy(catalogId: string) {
    setBusy(catalogId)
    setError(null)
    try {
      await api('/api/properties/buy', { method: 'POST', body: JSON.stringify({ catalogId }) })
      await load()
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The sale did not file.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="max-w-xl text-sm text-muted-foreground">
        A garage qualifies you for the elite vault survey. Other lots stay off the book until they are priced.
      </p>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!catalog && !error ? <Notice tone="muted">Reading the deeds…</Notice> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {catalog?.map((lot) => (
          <article key={lot.id} className="border border-border bg-card p-5">
            <p className="font-mono text-[9px] uppercase text-muted-foreground">{lot.owned ? 'Held' : 'For sale'}</p>
            <h2 className="font-display text-3xl font-semibold uppercase">{lot.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{lot.note}</p>
            <p className="mt-4 font-mono text-sm text-primary">{money(lot.price)}</p>
            {lot.owned ? (
              <p className="mt-4 text-sm text-success">On your ledger.</p>
            ) : (
              <Btn className="mt-4" variant="gold" disabled={busy !== null || (me !== null && me.cash < lot.price)} onClick={() => void buy(lot.id)}>
                {busy === lot.id ? 'Buying…' : 'Buy'}
              </Btn>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
