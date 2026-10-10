import { useEffect, useState, type FormEvent } from 'react'
import { ModBuyWarning } from '../components/ModBuyWarning.tsx'
import { Btn, Field, Notice, PageTitle, inputClass } from '../components/ui.tsx'
import { ApiError, api, load, peek } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import { modSlotUnlockHint } from '../lib/modSlots.ts'
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
  const { me, applyCash, applySpend, patchMe } = useAuth()
  const [vault, setVault] = useState<VaultView | null>(() => peek<VaultView>('/api/me/vault'))
  const [amount, setAmount] = useState('5000')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  type ModsFile = {
    owned: { instanceId: string; modId: string; kind: string; status: string; name: string; description: string }[]
    shopVault: { id: string; name: string; price: number | null; description: string }[]
    vaultSlots: number
  }
  const [mods, setMods] = useState<ModsFile | null>(null)
  const [pendingBuy, setPendingBuy] = useState<{ modId: string; price: number | null } | null>(null)
  const repLevel = me?.level ?? 1
  const vaultSlotHint = modSlotUnlockHint('vault', repLevel)

  async function reload() {
    const [v, m] = await Promise.all([load<VaultView>('/api/me/vault'), load<ModsFile>('/api/mods')])
    setVault(v)
    setMods(m)
  }

  async function buyVaultMod(modId: string, price: number | null) {
    setBusy(true)
    setError(null)
    try {
      await api('/api/mods/buy', { method: 'POST', body: JSON.stringify({ modId }) })
      await reload()
      if (me && price != null) applyCash(me.cash - price)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Purchase failed.')
    } finally {
      setBusy(false)
      setPendingBuy(null)
    }
  }

  function requestBuyVaultMod(modId: string, price: number | null) {
    if (repLevel < 15) {
      setPendingBuy({ modId, price })
      return
    }
    void buyVaultMod(modId, price)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not open the vault.'))
  }, [])

  async function upgrade() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const next = await api<VaultView & { spent?: number; paidFrom?: string }>('/api/vault/upgrade', {
        method: 'POST',
        body: '{}',
      })
      setVault(next)
      if (next.spent) applySpend(next.spent)
      setNote('The door is heavier.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upgrade failed.')
    } finally {
      setBusy(false)
    }
  }

  async function move(kind: 'withdraw' | 'withdraw-all' | 'deposit' | 'deposit-all') {
    setBusy(true)
    setError(null)
    setNote(null)
    const snapshot = me?.cash
    const path = kind.startsWith('deposit') ? '/api/vault/deposit' : '/api/vault/withdraw'
    const body = kind.endsWith('all') ? { all: true } : { amount: Number(amount) }
    try {
      const paid = await api<{ cash: number; amount: number; balance: number }>(path, { method: 'POST', body: JSON.stringify(body) })
      patchMe((current) => ({ ...current, cash: paid.cash, vault: { ...current.vault, balance: paid.balance } }))
      setVault((current) => (current ? { ...current, balance: paid.balance } : current))
      setNote(kind.startsWith('deposit') ? `Deposited ${money(paid.amount)}.` : `Withdrew ${money(paid.amount)}.`)
    } catch (err) {
      if (snapshot != null) applyCash(snapshot)
      setError(err instanceof ApiError ? err.message : 'The vault did not move the cash.')
    } finally {
      setBusy(false)
    }
  }

  async function onMoveSubmit(event: FormEvent) {
    event.preventDefault()
    await move(vault?.creditCard || me?.vaultCreditCard ? 'deposit' : 'withdraw')
  }

  const shown = vault ?? (me ? { balance: me.vault.balance, level: me.vault.level, maxLevel: 5, upgradeCost: null, tier: 'standard', tierLabel: 'Standard Vault' } : null)
  if (!shown && !error) return <Notice tone="muted">Opening the vault…</Notice>
  if (!shown) return <Notice tone="danger">{error}</Notice>

  return (
    <div className="space-y-4">
      <PageTitle kicker="Facility">Vault facility</PageTitle>
      {shown.tierLabel ? (
        <section className="border border-border bg-card p-5">
          <p className="font-mono text-[9px] uppercase text-primary">{shown.tierLabel}</p>
          <p className="font-display text-4xl font-semibold uppercase">Level {shown.level}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Defense {shown.defense} ·{' '}
            {shown.capacityUnlimited || shown.capacity == null
              ? 'Capacity unlimited'
              : `Capacity ${money(shown.capacity)}`}
            {shown.creditCard ? ' · Card spend' : ''}
            {typeof shown.modSlots === 'number'
              ? ` · Mod slots ${shown.modSlotsUsed ?? 0}/${shown.modSlots} (${vaultSlotHint})`
              : ''}
          </p>
          {pendingBuy ? (
            <ModBuyWarning
              busy={busy}
              onDismiss={() => setPendingBuy(null)}
              onBuyAnyway={() => void buyVaultMod(pendingBuy.modId, pendingBuy.price)}
            />
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono uppercase">
            {['standard', 'silver', 'gold', 'diamond'].map((tier) => (
              <span key={tier} className={`border px-2 py-1 ${shown.tier === tier ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>{tier}</span>
            ))}
          </div>
          <p className="mt-4 text-sm">Secured {shown.secured != null ? money(shown.secured) : '—'} · Exposed {shown.exposed != null ? money(shown.exposed) : '—'}</p>
          {shown.next ? (
            <p className="mt-3 text-sm">
              Next upgrade: {shown.next.tierLabel} level {shown.next.level} · defense {shown.next.defense}
              {shown.next.capacityUnlimited || shown.next.capacity == null
                ? ' · capacity unlimited'
                : ` · max capacity ${money(shown.next.capacity)}`}
            </p>
          ) : null}
          <p className="mt-4 border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
            A successful robbery leaves the vault open, so a later heist can reach the whole balance. Insurance puts the vault back up after the hit. The stolen cash still leaves.
          </p>
          <div className="mt-4">
            <Btn
              variant={shown.insured ? 'ghost' : 'gold'}
              disabled={busy}
              onClick={() => {
                setBusy(true)
                api('/api/vault/insurance', { method: 'POST', body: JSON.stringify({ enabled: !shown.insured }) })
                  .then(() => reload())
                  .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Insurance did not file.'))
                  .finally(() => setBusy(false))
              }}
            >
              {shown.insured ? 'Drop insurance' : `Vault insurance · ${money(shown.insurancePremium ?? 1750)} / day · 100% cover`}
            </Btn>
          </div>
          {mods ? (
            <div className="mt-6 border-t border-border pt-4">
              <p className="font-mono text-[9px] uppercase text-primary">
                Vault modifications · {mods.vaultSlots} slots ({vaultSlotHint})
              </p>
              <div className="mt-3 space-y-2">
                {mods.shopVault.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border border-border px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{row.name}</span>
                      <span className="ml-2 text-muted-foreground">{row.description}</span>
                    </span>
                    <Btn
                      disabled={busy || row.price == null}
                      onClick={() => requestBuyVaultMod(row.id, row.price)}
                    >
                      Buy {row.price != null ? money(row.price) : '—'}
                    </Btn>
                  </div>
                ))}
                {mods.owned
                  .filter((row) => row.kind === 'vault')
                  .map((row) => (
                    <div key={row.instanceId} className="flex flex-wrap items-center justify-between gap-2 border border-border px-3 py-2 text-sm">
                      <span>
                        {row.name} · {row.status}
                      </span>
                      <div className="flex gap-2">
                        {row.status === 'inventory' ? (
                          <Btn
                            disabled={busy}
                            onClick={() => {
                              setBusy(true)
                              api('/api/mods/vault/install', {
                                method: 'POST',
                                body: JSON.stringify({ instanceId: row.instanceId }),
                              })
                                .then(() => reload())
                                .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Install failed.'))
                                .finally(() => setBusy(false))
                            }}
                          >
                            Install
                          </Btn>
                        ) : (
                          <>
                            {row.modId === 'emergency-lockdown' ? (
                              <Btn
                                disabled={busy}
                                onClick={() => {
                                  setBusy(true)
                                  api('/api/mods/vault/lockdown', { method: 'POST', body: '{}' })
                                    .then(() => reload())
                                    .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Arm failed.'))
                                    .finally(() => setBusy(false))
                                }}
                              >
                                Arm lockdown
                              </Btn>
                            ) : null}
                            <Btn
                              disabled={busy}
                              onClick={() => {
                                setBusy(true)
                                api('/api/mods/vault/remove', {
                                  method: 'POST',
                                  body: JSON.stringify({ instanceId: row.instanceId }),
                                })
                                  .then(() => reload())
                                  .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Remove failed.'))
                                  .finally(() => setBusy(false))
                              }}
                            >
                              Remove
                            </Btn>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="border border-line bg-panel p-4">
          <div className="grid min-h-[280px] place-items-center border border-line/80 bg-ink">
            <div className="w-[70%] border border-gold/30 p-6 text-center">
              <p className="text-[10px] tracking-[0.22em] text-muted uppercase">Inner cage</p>
              <p className="mt-2 font-serif text-4xl text-gold">{money(shown.balance)}</p>
              <p className="mt-2 text-sm text-muted">Level {shown.level} of {shown.maxLevel}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">{notes[shown.level] ?? notes[1]}</p>
        </section>
        <aside className="space-y-4 border border-line bg-panel p-4">
          <dl className="space-y-3 text-sm">
            <Row label={shown.creditCard ? 'Card' : 'Balance'} value={money(shown.balance)} gold />
            {shown.creditCard ? null : <Row label="Pocket" value={me ? money(me.cash) : '—'} gold />}
            <Row label="Level" value={`${shown.level} / ${shown.maxLevel}`} />
            <Row label="Protection" value={`Level ${shown.level}`} />
          </dl>
          {shown.creditCard ? (
            <p className="text-sm text-muted-foreground">
              Level 11 card: buys and fees charge this vault balance directly. Withdrawals are closed. Deposit any leftover pocket
              cash anytime
              {shown.capacityUnlimited ? ' — capacity is unlimited on Diamond L5.' : '.'}
            </p>
          ) : null}
          {shown.upgradeCost === null ? (
            <p className="text-sm text-muted">This vault is finished.</p>
          ) : (
            <Btn variant="gold" disabled={busy} onClick={() => void upgrade()}>
              Upgrade for {money(shown.upgradeCost)}
            </Btn>
          )}
          <form className="space-y-2" onSubmit={(event) => void onMoveSubmit(event)}>
            <Field label={shown.creditCard ? 'Deposit pocket cash into the vault' : 'Move between pocket and vault'}>
              <input
                className={inputClass}
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {shown.withdrawEnabled !== false ? (
                <>
                  <Btn type="submit" disabled={busy}>
                    Withdraw
                  </Btn>
                  <Btn type="button" disabled={busy} onClick={() => void move('withdraw-all')}>
                    Withdraw all
                  </Btn>
                </>
              ) : null}
              <Btn type="button" disabled={busy} onClick={() => void move('deposit')}>
                Deposit
              </Btn>
              <Btn type="button" variant="gold" disabled={busy} onClick={() => void move('deposit-all')}>
                Deposit all
              </Btn>
            </div>
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
