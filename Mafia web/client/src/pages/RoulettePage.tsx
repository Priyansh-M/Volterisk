import { useState } from 'react'
import { ChipList, RouletteTable, RouletteWheel, useRoulette } from '../vendor/roulette/index.ts'
import type { AvailableNumbers, IOnBetParams } from '../vendor/roulette/types.ts'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

const chips = {
  '1': '/roulette/white-chip.png',
  '10': '/roulette/blue-chip.png',
  '100': '/roulette/black-chip.png',
  '500': '/roulette/cyan-chip.png',
}

export function RoulettePage() {
  const { me, applyCash } = useAuth()
  const { bets, total, onBet, clearBets } = useRoulette()
  const [chip, setChip] = useState('1')
  const [winner, setWinner] = useState<AvailableNumbers | '-1'>('-1')
  const [spinning, setSpinning] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState(true)
  const cash = me?.cash ?? 0
  const vault = me?.vault.balance ?? 0
  const cap = Math.floor((cash + vault) * 0.05)

  function place(params: IOnBetParams) {
    const next = total + Number(chip)
    if (next > cap) {
      setError(`That chip passes the 5% cap of ${money(cap)}.`)
      return
    }
    if (next > cash) {
      setError('Not enough cash. Check your vault.')
      return
    }
    setError(null)
    onBet(chip)(params)
  }

  async function spin() {
    const placed = Object.entries(bets).map(([id, bet]) => ({ id, amount: bet.amount }))
    if (!placed.length || spinning) return
    setError(null)
    setNote(null)
    setSpinning(true)
    try {
      const result = await api<{ number: string; returned: number; stake: number; cash: number }>('/api/casino/roulette', {
        method: 'POST',
        body: JSON.stringify({ bets: placed }),
      })
      applyCash(result.cash)
      setWinner(result.number as AvailableNumbers)
      setNote(
        result.returned > 0
          ? `The ball landed on ${result.number}. The table paid ${money(result.returned)}.`
          : `The ball landed on ${result.number}. The stake stayed with the house.`,
      )
    } catch (err) {
      setSpinning(false)
      setError(err instanceof ApiError ? err.message : 'The wheel did not take the spin.')
    }
  }

  return (
    <div className="space-y-4">
      {rules ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4">
          <section className="w-full max-w-lg border border-primary bg-card p-6 shadow-2xl">
            <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">House rules</p>
            <h2 className="mt-2 font-display text-3xl font-semibold uppercase">European roulette</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The wheel is 0 through 36. Put chips on the felt, then spin. The server rolls the number. You do not.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Only pocket cash can be staked. One spin cannot exceed 5% of your total, cash plus vault. A straight number pays 35 to 1. Red, black, odd, even, and the halves pay 1 to 1.
            </p>
            <button type="button" className="gloss-gold mt-5 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={() => setRules(false)}>
              I understand
            </button>
          </section>
        </div>
      ) : null}
      <div className="border border-primary/50 bg-card px-4 py-3">
        <p className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">Table limit</p>
        <p className="mt-1 text-sm text-foreground">
          Only 5% of your total can be gambled. Cap {money(cap)}. Cash on hand {money(cash)}. On the felt {money(total)}.
        </p>
      </div>
      <div className="overflow-x-auto border border-border bg-card p-3">
        <RouletteWheel start={spinning} winningBet={winner} layoutType="european" onSpinningEnd={() => { setSpinning(false); clearBets() }} />
        <RouletteTable chips={chips} bets={bets} onBet={place} layoutType="european" readOnly={spinning} />
        <div className="mt-3">
          <ChipList chips={chips} selectedChip={chip} onChipPressed={setChip} />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {note ? <p className="text-sm text-foreground">{note}</p> : null}
      <div className="flex gap-2">
        <button type="button" className="nav-pill cursor-pointer px-4 py-2 text-xs" disabled={spinning} onClick={() => { clearBets(); setError(null) }}>
          Clear
        </button>
        <button type="button" className="gloss-gold cursor-pointer px-4 py-2 text-xs disabled:opacity-40" disabled={spinning || total < 1} onClick={() => void spin()}>
          {spinning ? 'Spinning…' : 'Spin'}
        </button>
      </div>
    </div>
  )
}
