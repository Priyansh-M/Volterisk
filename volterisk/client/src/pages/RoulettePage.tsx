import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChipList, RouletteTable, RouletteWheel, useRoulette } from '../vendor/roulette/index.ts'
import type { AvailableNumbers, IOnBetParams } from '../vendor/roulette/types.ts'
import { ApiError, api, load } from '../lib/api.ts'
import { inputClass } from '../components/ui.tsx'
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
type Seat = { userId: string; username: string; laid: boolean; bets: { id: string; amount: number }[] }
type Lobby = {
  id: string
  hostName: string
  youAreHost: boolean
  spinToken: number
  lastNumber: string | null
  seats: Seat[]
  invites: { userId: string; username: string }[]
  yourResult: Verdict | null
}

export function RoulettePage() {
  const { me, applyCash } = useAuth()
  const [params] = useSearchParams()
  const joined = params.get('lobby')
  const [mode, setMode] = useState<'ask' | 'solo' | 'lobby'>(joined ? 'lobby' : 'ask')
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [seenSpin, setSeenSpin] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ id: string; username: string }[]>([])
  const { bets, total, onBet, clearBets } = useRoulette()
  const [chip, setChip] = useState('1')
  const [winner, setWinner] = useState<AvailableNumbers | '-1'>('-1')
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState(() => sessionStorage.getItem(SEEN) !== '1')
  const [table, setTable] = useState<TableState | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [ended, setEnded] = useState(false)
  const confirmed = useRef(false)
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

  useEffect(() => {
    if (!joined) return
    api<Lobby>(`/api/casino/lobby/${joined}`)
      .then((room) => {
        setLobby(room)
        setSeenSpin(room.spinToken)
        setMode('lobby')
      })
      .catch(() => {
        window.setTimeout(() => {
          api<Lobby>(`/api/casino/lobby/${joined}`)
            .then((room) => {
              setLobby(room)
              setSeenSpin(room.spinToken)
              setMode('lobby')
            })
            .catch(() => setMode('ask'))
        }, 250)
      })
  }, [joined])

  useEffect(() => {
    if (mode !== 'lobby' || !lobby) return
    let pending = false
    const timer = window.setInterval(() => {
      if (pending || document.hidden) return
      pending = true
      api<Lobby>(`/api/casino/lobby/${lobby.id}`)
        .then((room) => {
          setLobby(room)
          if (seenSpin !== null && room.spinToken !== seenSpin && room.lastNumber) {
            setSeenSpin(room.spinToken)
            setWinner(room.lastNumber as AvailableNumbers)
            setSpinning(true)
            if (room.yourResult) setVerdict(room.yourResult)
          }
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
            setLobby(null)
            setMode('ask')
            setEnded(true)
          }
        })
        .finally(() => {
          pending = false
        })
    }, 1500)
    return () => window.clearInterval(timer)
  }, [mode, lobby?.id, seenSpin])

  useEffect(() => {
    const q = query.trim()
    if (mode !== 'lobby' || q.length < 2) {
      setFound([])
      return
    }
    const timer = window.setTimeout(() => {
      api<{ players: { id: string; username: string }[] }>(`/api/players/search?q=${encodeURIComponent(q)}`)
        .then((data) => setFound(data.players))
        .catch(() => setFound([]))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, mode])

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
    if (confirmed.current && lobby && !lobby.youAreHost) {
      confirmed.current = false
      void api(`/api/casino/lobby/${lobby.id}/bets`, { method: 'POST', body: JSON.stringify({ bets: [] }) }).catch(() => undefined)
      setLobby((room) => room ? { ...room, seats: room.seats.map((seat) => seat.userId === me?.id ? { ...seat, laid: false, bets: [] } : seat) } : room)
    }
    onBet(chip)(params)
  }

  async function openLobby() {
    const room = await api<Lobby>('/api/casino/lobby', { method: 'POST', body: '{}' })
    setLobby(room)
    setSeenSpin(room.spinToken)
    setMode('lobby')
  }

  async function invite(userId: string) {
    if (!lobby) return
    setLobby(await api<Lobby>(`/api/casino/lobby/${lobby.id}/invite`, { method: 'POST', body: JSON.stringify({ userId }) }))
    setQuery('')
    setFound([])
  }

  async function spin() {
    const placed = Object.entries(bets).map(([id, bet]) => ({ id, amount: bet.amount }))
    if (spinning || locked) return
    if (!placed.length && !(lobby && lobby.youAreHost)) return
    setError(null)
    if (lobby && mode === 'lobby') {
      await api(`/api/casino/lobby/${lobby.id}/bets`, { method: 'POST', body: JSON.stringify({ bets: placed }) })
      if (!lobby.youAreHost) {
        confirmed.current = true
        setLobby((room) => room ? { ...room, seats: room.seats.map((seat) => seat.userId === me?.id ? { ...seat, laid: true, bets: placed } : seat) } : room)
        setError(null)
        return
      }
      setSpinning(true)
      try {
        const room = await api<Lobby>(`/api/casino/lobby/${lobby.id}/spin`, { method: 'POST', body: '{}' })
        setLobby(room)
        setSeenSpin(room.spinToken)
        if (room.lastNumber) setWinner(room.lastNumber as AvailableNumbers)
        if (room.yourResult) setVerdict(room.yourResult)
        const status = await api<TableState>('/api/casino/roulette')
        setTable(status)
      } catch (err) {
        setSpinning(false)
        setError(err instanceof ApiError ? err.message : 'The wheel did not take the spin.')
      }
      return
    }
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
      {ended ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-background/80 p-4">
          <section className="w-full max-w-md border border-border bg-card p-8 text-center">
            <h2 className="font-display text-4xl font-semibold uppercase">Game has ended</h2>
            <button type="button" className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={() => setEnded(false)}>
              Close
            </button>
          </section>
        </div>
      ) : null}
      {mode === 'ask' ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 p-4">
          <section className="w-full max-w-md border border-primary bg-card p-6 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Casino</p>
            <h2 className="mt-2 font-display text-3xl font-semibold uppercase">How are you sitting?</h2>
            <button type="button" className="gloss-gold mt-5 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={() => setMode('solo')}>
              Enter alone
            </button>
            <button type="button" className="nav-pill mt-2 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={() => void openLobby()}>
              Make a lobby
            </button>
          </section>
        </div>
      ) : null}
      {rules && mode !== 'ask' ? <Rules onClose={() => { sessionStorage.setItem(SEEN, '1'); setRules(false) }} /> : null}
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
        <div className="wheel-row">
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
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <ChipList chips={chips} selectedChip={chip} onChipPressed={setChip} />
          {lobby && mode === 'lobby' ? <OtherBets seats={lobby.seats.filter((seat) => seat.userId !== me?.id && seat.laid)} /> : null}
          <div className="flex flex-col items-end gap-2">
            <p className="font-mono text-sm text-foreground">
              On the felt <span className="text-primary">{money(total)}</span>
            </p>
            {(mode !== 'lobby' || lobby?.youAreHost ? total > 0 : Boolean(lobby?.seats.some((seat) => seat.userId === me?.id && seat.laid))) ? <PlacedMark /> : null}
          </div>
        </div>
      </div>
      {lobby && mode === 'lobby' ? (
        <section className="border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Table · {lobby.seats.length}/5 · host: {lobby.hostName}</p>
          <ul className="mt-2 text-sm">
            {lobby.seats.map((seat) => (
              <li key={seat.userId} className="mt-2 flex flex-wrap items-center gap-2">
                <span>{seat.username}</span>
                {(seat.userId === me?.id && lobby.youAreHost ? total > 0 || seat.laid : seat.laid) ? <PlacedMark /> : null}
              </li>
            ))}
          </ul>
          {lobby.youAreHost ? (
            <>
            <div className="relative mt-3 max-w-md">
              <input className={inputClass} value={query} placeholder="Search a player" onChange={(event) => setQuery(event.target.value)} />
              {found.length ? (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto border border-border bg-card">
                  {found.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>{row.username}</span>
                      <button type="button" className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-primary" onClick={() => void invite(row.id)}>Invite</button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              className="nav-pill mt-3 cursor-pointer px-4 py-2 text-[11px] tracking-[0.14em] uppercase"
              onClick={() => {
                void api(`/api/casino/lobby/${lobby.id}/leave`, { method: 'POST', body: '{}' }).finally(() => {
                  setLobby(null)
                  setMode('ask')
                })
              }}
            >
              End game
            </button>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Lay your chips, then wait. The host spins once for the table.</p>
          )}
        </section>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" className="nav-pill cursor-pointer px-4 py-2 text-xs" disabled={spinning || locked} onClick={() => { clearBets(); setError(null); if (confirmed.current && lobby && !lobby.youAreHost) { confirmed.current = false; void api(`/api/casino/lobby/${lobby.id}/bets`, { method: 'POST', body: JSON.stringify({ bets: [] }) }) } }}>
          Clear
        </button>
        <button type="button" className="gloss-gold cursor-pointer px-4 py-2 text-xs disabled:opacity-40" disabled={spinning || locked || total < 1 || Boolean(lobby && mode === 'lobby' && lobby.youAreHost && lobby.seats.some((seat) => seat.userId !== me?.id && !seat.laid))} onClick={() => void spin()}>
          {spinning ? 'Spinning…' : lobby && !lobby.youAreHost ? 'Lay chips' : 'Spin'}
        </button>
      </div>
    </div>
  )
}

function PlacedMark() {
  return <span className="border border-primary bg-primary/15 px-2 py-1 font-mono text-[11px] tracking-[0.14em] text-primary">[CHIPS HAVE BEEN PLACED]</span>
}

const REDS = new Set(['1', '3', '5', '7', '9', '12', '14', '16', '18', '19', '21', '23', '25', '27', '30', '32', '34', '36'])

function betTone(id: string) {
  if (id === '0') return 'border-[#2f6b45] bg-[#1c3a28] text-[#b7e0c4]'
  if (id === 'RED' || REDS.has(id)) return 'border-[#8c3a32] bg-[#3a1c18] text-[#f0c2bc]'
  if (id === 'BLACK') return 'border-[#3a342c] bg-[#14110e] text-[#f4efe6]'
  if (/^\d+$/.test(id)) return 'border-[#3a342c] bg-[#14110e] text-[#f4efe6]'
  return 'border-primary/50 bg-primary/10 text-primary'
}

function OtherBets({ seats }: { seats: Seat[] }) {
  const [open, setOpen] = useState<string | null>(null)
  if (!seats.length) return null
  return (
    <div className="min-w-[12rem] flex-1 space-y-2 border border-primary bg-background px-3 py-2">
      {seats.map((seat) => {
        const bets = seat.bets ?? []
        const shown = open === seat.userId ? bets : bets.slice(0, 3)
        return (
          <div key={seat.userId} className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="mr-1 font-semibold text-foreground">{seat.username}</span>
            {shown.map((bet) => (
              <span key={bet.id} className="inline-flex items-center gap-1 font-mono text-[10px] text-foreground">
                <span className={`border px-1 py-0.5 ${betTone(bet.id)}`}>{bet.id}</span>
                <span>: {bet.amount}</span>
              </span>
            ))}
            {bets.length > 3 ? (
              <button type="button" aria-label={open === seat.userId ? 'Show less' : 'See more'} className="cursor-pointer px-1 text-primary" onClick={() => setOpen(open === seat.userId ? null : seat.userId)}>
                {open === seat.userId ? '▴' : '▾'}
              </button>
            ) : null}
          </div>
        )
      })}
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
