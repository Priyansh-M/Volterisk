import { useEffect, useState, type FormEvent } from 'react'
import { Btn, Field, Notice, PageTitle, inputClass } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import type { VaultView } from '../lib/types.ts'

const notes: Record<number, string> = {
  1: 'A rented closet and a padlock. The hinges tell the whole story.',
  2: 'A second hasp and a louder door. Still a room, not a vault.',
  3: 'Steel liner, one camera, a guard who smokes on the hour.',
  4: 'Inner cage and a time lock on the day gate.',
  5: 'Poured walls. You will be heard before you are seen.',
  6: 'Dual cages and a chair that stays occupied.',
  7: 'A box inside a box. Air and patience are rationed.',
  8: 'Plate steel, redundant alarms, a street that notices vans.',
  9: 'The door is a math problem with a payroll.',
  10: 'The city keeps its meanest numbers here.',
}

export function VaultPage() {
  const { me, refresh } = useAuth()
  const [vault, setVault] = useState<VaultView | null>(null)
  const [amount, setAmount] = useState('5000')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setVault(await api<VaultView>('/api/me/vault'))
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the vault.'))
  }, [])

  async function upgrade() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      setVault(await api<VaultView>('/api/vault/upgrade', { method: 'POST', body: '{}' }))
      await refresh()
      setNote('The door is heavier.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upgrade failed.')
    } finally {
      setBusy(false)
    }
  }

  async function withdraw(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await api('/api/vault/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) }),
      })
      await load()
      await refresh()
      setNote('Moved to cash.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Withdraw failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!vault && !error) return <Notice tone="muted">Opening the vault…</Notice>
  if (!vault) return <Notice tone="danger">{error}</Notice>

  return (
    <div className="space-y-4">
      <PageTitle kicker="Facility">Vault facility</PageTitle>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="border border-line bg-panel p-4">
          <div className="grid min-h-[280px] place-items-center border border-line/80 bg-ink">
            <div className="w-[70%] border border-gold/30 p-6 text-center">
              <p className="text-[10px] tracking-[0.22em] text-muted uppercase">Inner cage</p>
              <p className="mt-2 font-serif text-4xl text-gold">{money(vault.balance)}</p>
              <p className="mt-2 text-sm text-muted">Level {vault.level} of {vault.maxLevel}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">{notes[vault.level] ?? notes[1]}</p>
        </section>
        <aside className="space-y-4 border border-line bg-panel p-4">
          <dl className="space-y-3 text-sm">
            <Row label="Balance" value={money(vault.balance)} gold />
            <Row label="Pocket" value={me ? money(me.cash) : '—'} gold />
            <Row label="Level" value={`${vault.level} / ${vault.maxLevel}`} />
            <Row label="Protection" value={`Level ${vault.level}`} />
          </dl>
          {vault.upgradeCost === null ? (
            <p className="text-sm text-muted">This vault is finished.</p>
          ) : (
            <Btn variant="gold" disabled={busy} onClick={() => void upgrade()}>
              Upgrade for {money(vault.upgradeCost)}
            </Btn>
          )}
          <form className="space-y-2" onSubmit={(event) => void withdraw(event)}>
            <Field label="Withdraw to cash">
              <input
                className={inputClass}
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Btn type="submit" disabled={busy}>
              Withdraw
            </Btn>
          </form>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {note ? <Notice tone="ok">{note}</Notice> : null}
        </aside>
      </div>
    </div>
  )
}

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={gold ? 'font-semibold text-gold' : ''}>{value}</dd>
    </div>
  )
}
