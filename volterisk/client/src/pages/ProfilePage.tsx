import { useState } from 'react'
import { Portrait } from '../components/Portrait.tsx'
import { Btn, Notice, PageTitle, inputClass } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, remaining } from '../lib/format.ts'

export function ProfilePage() {
  const { me, refresh, patchMe, logout } = useAuth()
  const [blockName, setBlockName] = useState(me?.base?.name ?? '')
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingFace, setEditingFace] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nextName, setNextName] = useState(me?.username ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!me) return null

  return (
    <div className="space-y-4">
      <PageTitle kicker="File">Identity dossier</PageTitle>
      <section className="grid gap-6 border border-line bg-panel p-5 md:grid-cols-[120px_minmax(0,1fr)]">
        <div>
          <Portrait name={me.username} url={me.avatarUrl} className="h-28 w-28 border border-gold/40 text-4xl text-gold" />
          <button type="button" className="mt-2 cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-muted hover:text-gold" onClick={() => setEditingFace(true)}>
            Edit portrait
          </button>
        </div>
        <div>
          <div className="flex items-center gap-2">
            {editingName ? (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  setBusy(true)
                  setError(null)
                  void api<{ username: string }>('/api/me/name', { method: 'POST', body: JSON.stringify({ username: nextName.trim() }) })
                    .then((saved) => {
                      patchMe((current) => ({ ...current, username: saved.username }))
                      setEditingName(false)
                      setNote('Name updated.')
                    })
                    .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'The name did not save.'))
                    .finally(() => setBusy(false))
                }}
              >
                <input className={inputClass} value={nextName} maxLength={24} onChange={(event) => setNextName(event.target.value)} />
                <Btn type="submit" variant="gold" disabled={busy || nextName.trim().length < 3}>Save</Btn>
              </form>
            ) : (
              <>
                <h2 className="font-serif text-3xl tracking-wide">{me.username}</h2>
                <button
                  type="button"
                  aria-label="Edit name"
                  className="cursor-pointer text-muted hover:text-gold"
                  onClick={() => {
                    setNextName(me.username)
                    setEditingName(true)
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M4 20h4l10-10-4-4L4 16v4z" />
                  </svg>
                </button>
              </>
            )}
          </div>
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
      <section className="border border-destructive/40 bg-card p-4">
        <h2 className="font-display text-xl font-semibold uppercase">Account deletion</h2>
        <p className="mt-2 text-sm text-muted-foreground">This removes the ledger, the base, and the vault. It cannot be undone.</p>
        {confirmDelete ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn
              variant="gold"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                void api('/api/me', { method: 'DELETE' })
                  .then(() => logout())
                  .catch((err: unknown) => {
                    setError(err instanceof ApiError ? err.message : 'The account did not delete.')
                    setBusy(false)
                  })
              }}
            >
              {busy ? 'Deleting…' : 'Delete the account'}
            </Btn>
            <Btn onClick={() => setConfirmDelete(false)}>Cancel</Btn>
          </div>
        ) : (
          <Btn className="mt-3" onClick={() => setConfirmDelete(true)}>Delete account</Btn>
        )}
      </section>
      {editingFace ? (
        <AvatarDialog
          current={me.avatarUrl ?? ''}
          onClose={() => setEditingFace(false)}
          onSaved={() => {
            setEditingFace(false)
            setNote('Portrait saved.')
          }}
        />
      ) : null}
    </div>
  )
}

function AvatarDialog({ current, onClose, onSaved }: { current: string; onClose: () => void; onSaved: () => void }) {
  const { refresh } = useAuth()
  const [tab, setTab] = useState<'icon' | 'link'>(current.startsWith('icon:') ? 'icon' : 'link')
  const [link, setLink] = useState(current.startsWith('http') ? current : '')
  const [mark, setMark] = useState(current.startsWith('icon:') ? current : 'icon:crest')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api('/api/me/avatar', { method: 'POST', body: JSON.stringify({ url: tab === 'icon' ? mark : link.trim() }) })
      await refresh()
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The portrait did not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4">
      <section className="w-full max-w-md border border-border bg-card p-5 shadow-2xl">
        <h2 className="font-display text-2xl font-semibold uppercase">Edit portrait</h2>
        <div className="mt-4 flex justify-center">
          <div className="inline-flex border border-border bg-background p-1">
            <button type="button" className={`cursor-pointer px-4 py-1.5 text-xs ${tab === 'icon' ? 'bg-card text-foreground' : 'text-muted-foreground'}`} onClick={() => setTab('icon')}>
              Choose mark
            </button>
            <button type="button" className={`cursor-pointer px-4 py-1.5 text-xs ${tab === 'link' ? 'bg-card text-foreground' : 'text-muted-foreground'}`} onClick={() => setTab('link')}>
              Postimages link
            </button>
          </div>
        </div>
        {tab === 'icon' ? (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {['crest', 'crow', 'vault', 'wire'].map((id) => (
              <button key={id} type="button" className={`cursor-pointer border p-2 ${mark === `icon:${id}` ? 'border-primary' : 'border-border'}`} onClick={() => setMark(`icon:${id}`)}>
                <Portrait name={id} url={`icon:${id}`} className="mx-auto h-12 w-12 text-primary" />
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 border border-border p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">How to get your portrait link</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Open Postimages and upload your image.</li>
              <li>For a sharper picture, choose the Icon size before you upload.</li>
              <li>After it uploads, copy the Direct link.</li>
              <li>Paste that link below.</li>
            </ol>
            <a className="gloss-gold mt-4 block px-4 py-2 text-center text-[11px] font-semibold tracking-[0.16em] text-background uppercase no-underline" href="https://postimages.org/" target="_blank" rel="noreferrer">
              Open Postimages
            </a>
            <label className="mt-4 block text-foreground">
              Paste your image link
              <input className={`${inputClass} mt-1`} placeholder="https://i.postimg.cc/xxxxxx/avatar.png" value={link} onChange={(event) => setLink(event.target.value)} />
            </label>
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="gold" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </Btn>
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
