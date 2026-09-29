import { useEffect, useState } from 'react'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api, isMissing } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, remaining } from '../lib/format.ts'
import type { WorkBoard } from '../lib/types.ts'

export function WorkPage() {
  const { refresh } = useAuth()
  const [board, setBoard] = useState<WorkBoard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await api<WorkBoard>('/api/work/contracts')
    setBoard(data)
    setMissing(false)
  }

  useEffect(() => {
    load().catch((err: unknown) => {
      if (isMissing(err)) {
        setMissing(true)
        setBoard({ active: null, contracts: [] })
        return
      }
      setError(err instanceof ApiError ? err.message : 'The board did not come down.')
    })
  }, [])

  async function accept(contractId: string) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await api('/api/work/contracts/accept', {
        method: 'POST',
        body: JSON.stringify({ contractId }),
      })
      await load()
      setNote('The job is on the clock.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The board refused that job.')
    } finally {
      setBusy(false)
    }
  }

  async function collect() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const paid = await api<{ reward: number }>('/api/work/contracts/collect', { method: 'POST', body: '{}' })
      await load()
      await refresh()
      setNote(`Collected ${money(paid.reward)}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The payout is not ready.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle kicker="Board">Contract board</PageTitle>
      {missing ? <Notice tone="muted">The work board has not been posted.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {note ? <Notice tone="ok">{note}</Notice> : null}
      {!board && !error ? <Notice tone="muted">Reading the board…</Notice> : null}
      {board?.active ? (
        <section className="border border-gold/40 bg-panel p-4">
          <p className="text-[10px] tracking-[0.22em] text-gold uppercase">On the clock</p>
          <h2 className="mt-1 font-serif text-2xl">{board.active.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {board.active.locationLabel} · {board.active.risk.toLowerCase()} risk · {money(board.active.reward)}
          </p>
          <div className="mt-3">
            {board.active.ready ? (
              <Btn variant="gold" disabled={busy} onClick={() => void collect()}>
                {busy ? 'Collecting…' : 'Collect'}
              </Btn>
            ) : (
              <p className="text-sm text-muted">Finishes in {remaining(board.active.completesAt)}.</p>
            )}
          </div>
        </section>
      ) : null}
      <div className="border border-line">
        <div className="hidden border-b border-line px-4 py-2 text-[10px] tracking-[0.16em] text-muted uppercase md:grid md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_auto]">
          <span>Contract</span>
          <span>Location</span>
          <span>Time</span>
          <span>Risk</span>
          <span className="text-right">Payout</span>
        </div>
        {board?.contracts.map((contract) => (
          <article key={contract.id} className="grid gap-3 border-b border-line bg-panel p-4 last:border-b-0 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_auto] md:items-center">
            <div>
              <h2 className="font-serif text-lg">{contract.name}</h2>
              <p className="text-[12px] text-muted">{contract.requirement}</p>
            </div>
            <p className="text-sm text-muted">{contract.locationLabel}</p>
            <p className="text-sm">{contract.durationMinutes}m</p>
            <p className={contract.risk === 'HIGH' ? 'text-sm text-danger' : contract.risk === 'MEDIUM' ? 'text-sm text-gold' : 'text-sm text-ok'}>
              {contract.risk}
            </p>
            <div className="flex items-center justify-between gap-3 md:justify-end">
              <span className="text-gold">{money(contract.reward)}</span>
              {contract.locked ? (
                <Btn disabled>Level {contract.minLevel}</Btn>
              ) : contract.cooldownEndsAt ? (
                <Btn disabled>Cooling {remaining(contract.cooldownEndsAt)}</Btn>
              ) : contract.available ? (
                <Btn variant="gold" disabled={busy} onClick={() => void accept(contract.id)}>
                  Accept
                </Btn>
              ) : (
                <Btn disabled>Board is busy</Btn>
              )}
            </div>
          </article>
        ))}
      </div>
      {board && board.contracts.length === 0 && !missing ? <Notice tone="muted">Nothing is offered this watch.</Notice> : null}
    </div>
  )
}
