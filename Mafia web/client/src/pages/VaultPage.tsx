import { useEffect, useState, type FormEvent } from 'react'
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
  const { refresh } = useAuth()
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

  if (!vault && !error) return <p className="text-sm text-muted">Opening the vault…</p>
  if (!vault) return <p className="text-sm text-danger">{error}</p>

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-serif text-3xl">Vault</h1>
      <section className="rounded-lg border border-line bg-panel p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Balance</p>
        <p className="mt-1 font-serif text-3xl text-gold">{money(vault.balance)}</p>
        <p className="mt-2 text-sm">Level {vault.level} of {vault.maxLevel}</p>
        <p className="mt-3 text-sm text-muted">{notes[vault.level] ?? notes[1]}</p>
      </section>
      <section className="rounded-lg border border-line bg-panel p-4">
        {vault.upgradeCost === null ? (
          <p className="text-sm text-muted">This vault is finished.</p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void upgrade()}
            className="cursor-pointer rounded-md bg-gold px-3 py-2 text-sm font-medium text-ink disabled:opacity-50"
          >
            Upgrade for {money(vault.upgradeCost)}
          </button>
        )}
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(event) => void withdraw(event)}>
          <label className="text-sm">
            Withdraw to cash
            <input
              className="mt-1 block w-36 rounded-md border border-line bg-ink px-3 py-2"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="cursor-pointer rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
          >
            Withdraw
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {note ? <p className="mt-3 text-sm text-ok">{note}</p> : null}
      </section>
    </div>
  )
}
