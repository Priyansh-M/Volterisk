import { useState } from 'react'
import { Btn, Notice, PageTitle, inputClass } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, remaining } from '../lib/format.ts'

export function ProfilePage() {
  const { me, refresh } = useAuth()
  const [blockName, setBlockName] = useState(me?.base?.name ?? '')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!me) return null
  const initial = me.username.slice(0, 1).toUpperCase()

  return (
    <div className="space-y-4">
      <PageTitle kicker="File">Identity dossier</PageTitle>
      <section className="grid gap-6 border border-line bg-panel p-5 md:grid-cols-[120px_minmax(0,1fr)]">
        <div className="flex h-28 w-28 items-center justify-center border border-gold/40 font-serif text-4xl text-gold">
          {initial}
        </div>
        <div>
          <h2 className="font-serif text-3xl tracking-wide">{me.username}</h2>
          <p className="mt-1 text-sm text-muted">{me.title}</p>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Level" value={String(me.level)} />
            <Row label="Rank" value={`#${me.rank}`} />
            <Row label="Base" value={me.base ? `${me.base.name?.trim() || 'Unnamed'} · ${me.base.regionName}` : '—'} />
            <Row label="Current job" value={me.currentJob ? `${me.currentJob.name} · ${money(me.currentJob.payPerDay)} / day` : 'None'} />
            <Row label="Cash" value={money(me.cash)} gold />
            <Row label="Vault" value={`${money(me.vault.balance)} · lv ${me.vault.level}`} gold />
            <Row label="Equipped" value={me.equippedWeapon ? `${me.equippedWeapon.name} · lv ${me.equippedWeapon.effectiveLevel}` : '—'} />
            <Row label="Hits" value={String(me.stats.successfulHeists)} />
            <Row label="Misses" value={String(me.stats.failedHeists)} />
            <Row label="Stolen" value={money(me.stats.totalStolen)} gold />
            <Row label="Lost" value={money(me.stats.totalLost)} />
            <Row label="Cooldown" value={remaining(me.cooldownEndsAt)} />
            <Row label="Properties" value="—" />
          </dl>
          {me.base ? (
            <form
              className="mt-5 flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                setBusy(true)
                setError(null)
                setNote(null)
                void api('/api/map/base/name', { method: 'POST', body: JSON.stringify({ name: blockName.trim() }) })
                  .then(() => refresh())
                  .then(() => setNote('Block name saved.'))
                  .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'The name did not save.'))
                  .finally(() => setBusy(false))
              }}
            >
              <label className="text-sm text-muted">
                Block name
                <input className={`${inputClass} mt-1`} value={blockName} maxLength={32} onChange={(event) => setBlockName(event.target.value)} />
              </label>
              <Btn type="submit" variant="gold" disabled={busy || blockName.trim().length < 1}>
                {busy ? 'Saving…' : 'Save name'}
              </Btn>
            </form>
          ) : null}
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {note ? <Notice tone="ok">{note}</Notice> : null}
        </div>
      </section>
    </div>
  )
}

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 pb-2">
      <dt className="text-[11px] tracking-[0.14em] text-muted uppercase">{label}</dt>
      <dd className={gold ? 'text-gold' : ''}>{value}</dd>
    </div>
  )
}
