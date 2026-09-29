import { useEffect, useState } from 'react'
import { Btn, Notice, PageTitle, Panel } from '../components/ui.tsx'
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
      <PageTitle kicker="Contract board">Work</PageTitle>
      <p className="max-w-2xl text-sm text-muted">One job at a time. The server stamps the reward and the clock.</p>
      {missing ? <Notice tone="muted">The work board has not been posted.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {note ? <Notice tone="ok">{note}</Notice> : null}
      {!board && !error ? <Notice tone="muted">Reading the board…</Notice> : null}
      {board?.active ? (
        <Panel>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">On the clock</p>
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
        </Panel>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {board?.contracts.map((contract) => (
          <article key={contract.id} className="rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-serif text-xl">{contract.name}</h2>
              <span className={contract.risk === 'HIGH' ? 'text-sm text-danger' : contract.risk === 'MEDIUM' ? 'text-sm text-gold' : 'text-sm text-ok'}>
                {contract.risk}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {contract.locationLabel} · {contract.durationMinutes}m · {contract.requirement}
            </p>
            <p className="mt-2 font-semibold text-gold">{money(contract.reward)}</p>
            <div className="mt-3">
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
