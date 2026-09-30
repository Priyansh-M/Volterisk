import { useEffect, useState } from 'react'
import { ChipList, RouletteTable, RouletteWheel, useRoulette } from '../vendor/roulette/index.ts'
import type { AvailableNumbers, IOnBetParams } from '../vendor/roulette/types.ts'
import { ApiError, api, load } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import './roulette-skin.css'

const chips = {
  '1': '/roulette/white-chip.png',
  '10': '/roulette/blue-chip.png',
  '100': '/roulette/black-chip.png',
  '500': '/roulette/cyan-chip.png',
}

const SEEN = 'volterisk-roulette-rules'

type TableState = { cap: number; staked: number; locked: boolean }
type Verdict = { number: string; returned: number; stake: number }

export function RoulettePage() {
  const { me, applyCash } = useAuth()
  const { bets, total, onBet, clearBets } = useRoulette()
  const [chip, setChip] = useState('1')
  const [winner, setWinner] = useState<AvailableNumbers | '-1'>('-1')
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState(() => sessionStorage.getItem(SEEN) !== '1')
  const [table, setTable] = useState<TableState | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const cash = me?.cash ?? 0
  const cap = table?.cap ?? 0
  const staked = table?.staked ?? 0
  const locked = table?.locked ?? false
  const left = Math.max(0, cap - staked)
  const fill = cap > 0 ? Math.min(100, Math.round(((staked + (locked ? 0 : total)) / cap) * 100)) : 0

  useEffect(() => {
    load<TableState>('/api/casino/roulette')
      .then(setTable)
      .catch(() => setTable({ cap: 0, staked: 0, locked: false }))
  }, [])

  function place(params: IOnBetParams) {
    if (locked || spinning) return
    const next = total + Number(chip)
    if (next > left) {
      setError(`That chip passes today's remaining ${money(left)}.`)
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
    if (!placed.length || spinning || locked) return
    setError(null)
    setSpinning(true)
    try {
      const result = await api<{ number: string; returned: number; stake: number; cash: number; cap: number; staked: number; locked: boolean }>('/api/casino/roulette', {
        method: 'POST',
        body: JSON.stringify({ bets: placed }),
      })
      applyCash(result.cash)
      setTable({ cap: result.cap, staked: result.staked, locked: result.locked })
      setVerdict({ number: result.number, returned: result.returned, stake: result.stake })
      setWinner(result.number as AvailableNumbers)
    } catch (err) {
      setSpinning(false)
      setError(err instanceof ApiError ? err.message : 'The wheel did not take the spin.')
    }
  }

  return (
    <div className="relative space-y-4">
      {rules ? <Rules onClose={() => { sessionStorage.setItem(SEEN, '1'); setRules(false) }} /> : null}
      {verdict && !spinning ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 p-4">
          <section className={`w-full max-w-md border bg-card p-8 text-center shadow-2xl ${verdict.returned > 0 ? 'border-success' : 'border-destructive'}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Ball on {verdict.number}</p>
            <h2 className={`mt-3 font-display text-5xl font-semibold uppercase ${verdict.returned > 0 ? 'text-success' : 'text-destructive'}`}>
              {verdict.returned > 0 ? 'You won' : 'You lost'}
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              {verdict.returned > 0
                ? `The table paid ${money(verdict.returned)} on a ${money(verdict.stake)} stake.`
                : `${money(verdict.stake)} stayed with the house.`}
            </p>
            <button type="button" className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={() => setVerdict(null)}>
              Close
            </button>
          </section>
        </div>
      ) : null}
      <div className="border border-primary/50 bg-card">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">Table limit</p>
            <p className="mt-1 text-sm text-foreground">
              Today's allowance is {money(cap)}. Used {money(staked)}. Left {money(left)}.
            </p>
          </div>
          <button type="button" aria-label="House rules" className="shrink-0 cursor-pointer border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground" onClick={() => setRules(true)}>
            Help
          </button>
        </div>
        <div className="h-1.5 bg-background">
          <div className="h-full bg-primary" style={{ width: `${fill}%` }} />
        </div>
      </div>
      <div className={`volterisk-roulette relative overflow-x-auto border border-border bg-card p-3 ${locked ? 'pointer-events-none' : ''}`}>
        {locked ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 p-6 text-center">
            <p className="font-display text-4xl font-semibold uppercase text-foreground md:text-6xl">Come back tomorrow</p>
          </div>
        ) : null}
        <RouletteWheel
          start={spinning}
          winningBet={winner}
          layoutType="european"
          onSpinningEnd={() => {
            setSpinning(false)
            clearBets()
          }}
        />
        <RouletteTable chips={chips} bets={bets} onBet={place} layoutType="european" readOnly={spinning || locked} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <ChipList chips={chips} selectedChip={chip} onChipPressed={setChip} />
          <p className="font-mono text-sm text-foreground">
            On the felt <span className="text-primary">{money(total)}</span>
          </p>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" className="nav-pill cursor-pointer px-4 py-2 text-xs" disabled={spinning || locked} onClick={() => { clearBets(); setError(null) }}>
          Clear
        </button>
        <button type="button" className="gloss-gold cursor-pointer px-4 py-2 text-xs disabled:opacity-40" disabled={spinning || locked || total < 1} onClick={() => void spin()}>
          {spinning ? 'Spinning…' : 'Spin'}
        </button>
      </div>
    </div>
  )
}

function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4">
      <section className="w-full max-w-lg border border-primary bg-card p-6 shadow-2xl">
        <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">House rules</p>
        <h2 className="mt-2 font-display text-3xl font-semibold uppercase">How the wheel pays</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
          <p>The wheel has a single 0 and the numbers 1 through 36. Eighteen of those are red and eighteen are black. 0 is green and belongs to the house.</p>
          <p>Put chips on the felt, then press Spin. The number is chosen before the wheel moves. The spin is the ball catching up to that number.</p>
          <p>A chip on one number pays 35 to 1, and you get the chip back, so $1 returns $36. Red, black, even, odd, 1–18, and 19–36 pay 1 to 1. A dozen or a column pays 2 to 1. If the ball lands on 0, those outside bets lose.</p>
          <p>Only pocket cash is staked. Each day you may put down up to 5% of cash plus vault. That cap is fixed at the first spin of the day. When the bar is full, the table closes until tomorrow.</p>
        </div>
        <button type="button" className="gloss-gold mt-5 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={onClose}>
          I understand
        </button>
      </section>
    </div>
  )
}
