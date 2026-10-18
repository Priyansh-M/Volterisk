import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api, isBusy, load } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'
import { spendable } from '../lib/wallet.ts'
import './slots-skin.css'

type Tries = { sevens: { used: number; max: number }; vault: { used: number; max: number } }
type TableState = { cap: number; staked: number; locked: boolean; minBet: number; tries?: Tries }
type SpinResult = {
  machine: string
  reels: string[]
  label: string | null
  stake: number
  returned: number
  cash: number
  cap: number
  staked: number
  locked: boolean
  tries?: Tries
}

const ICONS: Record<string, string> = {
  cherry: `<svg viewBox="0 0 24 24" fill="none"><path d="M7 5c5 1 9 4 10 8" stroke="#d98b3a" stroke-width="1.4"/><circle cx="7" cy="16" r="4" fill="#c0392b"/><circle cx="15" cy="17" r="4" fill="#e0533c"/><path d="M17 5l-2 1" stroke="#7bbf5a" stroke-width="2" stroke-linecap="round"/></svg>`,
  lemon: `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8" ry="6" fill="#e7c13a"/><ellipse cx="9" cy="10" rx="2" ry="1.3" fill="#f2db86"/></svg>`,
  plum: `<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" fill="#7d5ba6"/><path d="M12 6c2-3 5-3 5-3" stroke="#7bbf5a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  grape: `<svg viewBox="0 0 24 24"><g fill="#8e6fc0"><circle cx="9" cy="12" r="3"/><circle cx="15" cy="12" r="3"/><circle cx="12" cy="16" r="3"/><circle cx="12" cy="9" r="3"/></g><path d="M12 6c1-3 4-3 4-3" stroke="#7bbf5a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  bell: `<svg viewBox="0 0 24 24"><path d="M6 17c0-6 2-9 6-9s6 3 6 9z" fill="#e7b73a"/><rect x="5" y="17" width="14" height="2" fill="#caa033"/><circle cx="12" cy="21" r="1.6" fill="#caa033"/></svg>`,
  seven: `<svg viewBox="0 0 24 24"><path d="M6 6h12l-6 13" stroke="#e0533c" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bar: `<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="1.5" fill="#d9b24a"/><text x="12" y="14" font-family="monospace" font-size="5.5" fill="#1a150a" text-anchor="middle" font-weight="700">BAR</text></svg>`,
  bar2: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="6" rx="1.5" fill="#d9b24a"/><rect x="3" y="13" width="18" height="6" rx="1.5" fill="#d9b24a"/></svg>`,
  bar3: `<svg viewBox="0 0 24 24"><rect x="3" y="3.5" width="18" height="5" rx="1.3" fill="#d9b24a"/><rect x="3" y="9.5" width="18" height="5" rx="1.3" fill="#d9b24a"/><rect x="3" y="15.5" width="18" height="5" rx="1.3" fill="#d9b24a"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.1L6.6 19l1.3-6-4.5-4 6-.6z" fill="#e7c13a"/></svg>`,
  diamond: `<svg viewBox="0 0 24 24"><path d="M12 3l7 6-7 12-7-12z" fill="#6fc0d9"/><path d="M5 9h14M12 3L9 9l3 12M12 3l3 6-3 12" stroke="#2a3a40" stroke-width=".7" fill="none"/></svg>`,
  coin: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#d9b24a"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#1a150a" stroke-width="1"/><text x="12" y="15" font-family="monospace" font-size="7" fill="#1a150a" text-anchor="middle" font-weight="700">$</text></svg>`,
  card: `<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2" fill="#b89a52"/><rect x="3" y="9" width="18" height="2.4" fill="#1a150a"/></svg>`,
  vault: `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1.5" fill="#8a8f98"/><circle cx="12" cy="12" r="4" fill="none" stroke="#1a150a" stroke-width="1.4"/><circle cx="12" cy="12" r="1.2" fill="#1a150a"/></svg>`,
  crown: `<svg viewBox="0 0 24 24"><path d="M4 18l-1-9 5 4 4-7 4 7 5-4-1 9z" fill="#e7c13a"/></svg>`,
}

const MACHINES = [
  {
    id: 'fruit', name: 'Fruit Classic', tag: 'Spin till daily cap',
    reel: ['cherry', 'lemon', 'plum', 'grape', 'bell', 'seven'],
    rows: [
      ['seven', 'Three Seven', 50, 'JACKPOT'],
      ['bell', 'Three Bell', 25, 'three in a row'],
      ['grape', 'Three Grape', 15, 'three in a row'],
      ['plum', 'Three Plum', 10, 'three in a row'],
      ['lemon', 'Three Lemon', 8, 'three in a row'],
      ['cherry', 'Three Cherry', 5, 'three in a row'],
      ['grape', 'Fruit Salad', 3, 'any 3 different fruits'],
      ['cherry', 'Two Cherry', 2, 'any two'],
      ['cherry', 'One Cherry', 0.5, 'any single'],
    ] as [string, string, number, string][],
  },
  {
    id: 'sevens', name: 'Lucky Sevens', tag: '8 spins a day · 12:00 GMT',
    reel: ['bar', 'bar2', 'bar3', 'star', 'diamond', 'seven'],
    rows: [
      ['seven', 'Three Seven', 250, 'JACKPOT'],
      ['diamond', 'Three Diamond', 100, 'Top prize'],
      ['star', 'Three Star', 60, 'three in a row'],
      ['bar3', 'Three Triple Bar', 40, 'three in a row'],
      ['bar2', 'Three Double Bar', 20, 'three in a row'],
      ['bar', 'Three Bar', 10, 'three in a row'],
      ['bar', 'Mixed Bars', 4, 'any 3 bar symbols'],
      ['seven', 'Two Seven', 5, 'any two'],
      ['diamond', 'Two Diamond', 3, 'any two'],
    ] as [string, string, number, string][],
  },
  {
    id: 'vault', name: 'Diamond Vault', tag: '4 spins a day · 12:00 GMT',
    reel: ['coin', 'card', 'vault', 'crown', 'diamond', 'seven'],
    rows: [
      ['seven', 'Three Seven', 300, 'JACKPOT'],
      ['diamond', 'Three Diamond', 120, 'Top prize'],
      ['crown', 'Three Crown', 40, 'three in a row'],
      ['vault', 'Three Vault', 20, 'three in a row'],
      ['card', 'Three Card', 12, 'three in a row'],
      ['coin', 'Three Coin', 8, 'three in a row'],
      ['vault', 'Full Portfolio', 4, 'coin + card + vault'],
      ['diamond', 'Two Diamond', 5, 'any two'],
      ['vault', 'Two Vault', 2, 'any two'],
    ] as [string, string, number, string][],
  },
]

const SPIN_MS = 3000
const SPIN_TILES = 60
const SETTLE_TILES = 6

function icon(id: string) {
  return ICONS[id] ?? ''
}

export function SlotsPage() {
  const { me, applyCash, applySpend, patchMe } = useAuth()
  const cash = spendable(me)
  const [table, setTable] = useState<TableState | null>(null)
  const [current, setCurrent] = useState(0)
  const [bet, setBet] = useState(100)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState('Pull to play')
  const [tone, setTone] = useState<'win' | 'lose' | ''>('')
  const [error, setError] = useState<string | null>(null)
  const strips = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const cabinet = useRef<HTMLDivElement>(null)
  const shown = useRef(['cherry', 'lemon', 'plum'])

  const cap = table?.cap ?? 0
  const staked = table?.staked ?? 0
  const locked = table?.locked ?? false
  const minBet = table?.minBet ?? 50
  const left = Math.max(0, cap - staked)
  const fill = cap > 0 ? Math.min(100, Math.round((staked / cap) * 100)) : 0
  const machine = MACHINES[current]
  const maxBet = Math.max(minBet, Math.min(left, cash))
  const tryRow = machine.id === 'sevens' ? table?.tries?.sevens : machine.id === 'vault' ? table?.tries?.vault : null
  const triesLeft = tryRow ? Math.max(0, tryRow.max - tryRow.used) : null
  const outOfTries = triesLeft === 0

  useEffect(() => {
    load<TableState>('/api/casino/slots')
      .then(setTable)
      .catch(() => setTable({ cap: 0, staked: 0, locked: false, minBet: 50 }))
  }, [])

  useEffect(() => {
    machine.reel.slice(0, 3).forEach((sym, i) => setStrip(i, sym))
    shown.current = machine.reel.slice(0, 3)
  }, [current, machine.reel])

  const rows = useMemo(() => machine.rows, [machine])

  function setStrip(i: number, sym: string) {
    const strip = strips[i].current
    if (!strip) return
    const H = strip.parentElement?.clientHeight ?? 40
    strip.style.transition = 'none'
    strip.style.transform = 'translateY(0)'
    strip.innerHTML = `<div class="tile" style="height:${H}px">${icon(sym)}</div>`
  }

  function clamp(raw: number) {
    let v = Math.floor(raw || 0)
    if (v < minBet) v = minBet
    if (left >= minBet && v > maxBet) v = maxBet
    setBet(v)
    return v
  }

  function spinReel(i: number, finalSym: string, settleMs: number) {
    return new Promise<void>((resolve) => {
      const strip = strips[i].current
      if (!strip) { resolve(); return }
      const H = strip.parentElement?.clientHeight ?? 40
      const pool = machine.reel
      let html = ''
      for (let k = 0; k < SPIN_TILES + SETTLE_TILES; k++) html += `<div class="tile" style="height:${H}px">${icon(pool[k % pool.length]!)}</div>`
      html += `<div class="tile" style="height:${H}px">${icon(finalSym)}</div>`
      strip.style.transition = 'none'
      strip.style.transform = 'translateY(0)'
      strip.innerHTML = html
      strip.classList.add('blur')
      void strip.offsetHeight
      strip.style.transition = `transform ${SPIN_MS}ms linear`
      strip.style.transform = `translateY(${-SPIN_TILES * H}px)`
      const onSpin = () => {
        strip.removeEventListener('transitionend', onSpin)
        strip.classList.remove('blur')
        strip.style.transition = `transform ${settleMs}ms cubic-bezier(.12,.7,.25,1)`
        strip.style.transform = `translateY(${-(SPIN_TILES + SETTLE_TILES) * H}px)`
        const onSettle = () => { strip.removeEventListener('transitionend', onSettle); resolve() }
        strip.addEventListener('transitionend', onSettle)
      }
      strip.addEventListener('transitionend', onSpin)
    })
  }

  async function spin() {
    if (spinning || locked || outOfTries) return
    const stake = clamp(bet)
    if (outOfTries) { setTone('lose'); setResult('That cabinet opens again at 12:00 GMT'); return }
    if (left < minBet) { setTone('lose'); setResult("Daily allowance used up"); return }
    if (stake > cash) { setTone('lose'); setResult('Not enough credits'); return }
    setSpinning(true)
    setError(null)
    setTone('')
    setResult('Spinning…')
    document.querySelectorAll('.volterisk-slots .reel').forEach((r) => r.classList.remove('win'))
    const cab = cabinet.current
    if (cab) { cab.classList.remove('shake'); void cab.offsetWidth; cab.classList.add('shake') }

    try {
      const row = await api<SpinResult>('/api/casino/slots', {
        method: 'POST',
        body: JSON.stringify({ machine: machine.id, bet: stake }),
      })
      await Promise.all([
        spinReel(0, row.reels[0]!, 650),
        spinReel(1, row.reels[1]!, 900),
        spinReel(2, row.reels[2]!, 1150),
      ])
      shown.current = row.reels
      if (row.returned > 0) {
        document.querySelectorAll('.volterisk-slots .reel').forEach((r) => r.classList.add('win'))
        setTone('win')
        setResult(`${row.label ?? 'Win'} — +${money(row.returned)}`)
      } else {
        setTone('lose')
        setResult('No line — try again')
      }
      if (me?.vaultCreditCard || (me?.level ?? 0) >= 11) {
        applySpend(row.stake)
        if (row.returned > 0) {
          patchMe((current) => ({
            ...current,
            vault: { ...current.vault, balance: current.vault.balance + row.returned },
          }))
        }
      } else {
        applyCash(row.cash)
      }
      setTable({ cap: row.cap, staked: row.staked, locked: row.locked, minBet, tries: row.tries })
    } catch (err) {
      const busy = isBusy(err) || (err instanceof ApiError && err.status >= 502)
      setTone('lose')
      setResult(busy ? 'Try that spin again' : err instanceof ApiError ? err.message : 'The cabinet jammed.')
      if (!busy) setError(err instanceof ApiError ? err.message : 'The cabinet jammed.')
    } finally {
      setSpinning(false)
    }
  }

  return (
    <div className="volterisk-slots space-y-4">
      <div className="border border-primary/50 bg-card">
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">Daily allowance</p>
            <p className="mt-1 text-sm text-foreground">
              Ten percent of the total. Today {money(cap)}. Used {money(staked)}. Left {money(left)}.
            </p>
          </div>
        </div>
        <div className="h-1.5 bg-background">
          <div className="h-full bg-primary" style={{ width: `${fill}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MACHINES.map((m, i) => (
          <button
            key={m.id}
            type="button"
            disabled={spinning}
            onClick={() => setCurrent(i)}
            className={`min-w-[150px] flex-1 cursor-pointer border px-3 py-2 text-left ${
              i === current ? 'border-primary bg-primary/10' : 'border-border bg-transparent'
            }`}
          >
            <div className={`font-display text-[15px] font-semibold tracking-[0.06em] uppercase ${i === current ? 'text-primary' : ''}`}>{m.name}</div>
            <div className="mt-0.5 font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
              {m.id === 'sevens' ? (
                <>
                  <span className="spin-glow">{table?.tries?.sevens.max ?? 8}</span>
                  {' '}spins per day · resets at 12.00pm GMT
                </>
              ) : m.id === 'vault' ? (
                <>
                  <span className="spin-glow">{table?.tries?.vault.max ?? 4}</span>
                  {' '}spins per day · resets at 12.00pm GMT
                </>
              ) : (
                m.tag
              )}
            </div>
          </button>
        ))}
      </div>

      <section className="stage border border-border bg-card p-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.22em] text-primary uppercase">Machine</p>
          <h2 className="mb-3 font-display text-2xl font-bold uppercase tracking-[0.04em]">{machine.name}</h2>
          <div className="machine" id="cabinet" ref={cabinet}>
            <svg className="cab" viewBox="0 0 240 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M44 86 C44 28 196 28 196 86" fill="#4b3ac9" />
              <path d="M44 86 C44 28 196 28 196 86" fill="none" stroke="#1a1208" strokeWidth="5" strokeLinejoin="round" />
              <path id="dome-arc" d="M62 74 C84 52 156 52 178 74" fill="none" />
              <text fill="#e23d8a" fontFamily="Barlow Condensed, sans-serif" fontSize="15" fontWeight="700" letterSpacing="1.6">
                <textPath href="#dome-arc" startOffset="50%" textAnchor="middle">VOLTERISK</textPath>
              </text>
              <rect x="28" y="78" width="172" height="108" rx="10" fill="#f2b53a" />
              <rect x="28" y="78" width="172" height="108" rx="10" fill="none" stroke="#1a1208" strokeWidth="5" />
              <rect x="37" y="85" width="154" height="70" rx="3" fill="#1a1208" />
              <rect x="40" y="88" width="46" height="64" fill="#f4f1e6" stroke="#1a1208" strokeWidth="2.5" />
              <rect x="91" y="88" width="46" height="64" fill="#f4f1e6" stroke="#1a1208" strokeWidth="2.5" />
              <rect x="142" y="88" width="46" height="64" fill="#f4f1e6" stroke="#1a1208" strokeWidth="2.5" />
              <path d="M20 176 H208 C214 176 218 184 214 194 H26 C22 184 14 176 20 176Z" fill="#f2b53a" stroke="#1a1208" strokeWidth="5" strokeLinejoin="round" />
              <rect x="200" y="108" width="10" height="38" rx="3" fill="#5a4ad4" stroke="#1a1208" strokeWidth="3" />
              <circle cx="205" cy="98" r="11" fill="#e23d8a" stroke="#1a1208" strokeWidth="3.5" />
            </svg>
            <div className="screen">
              <div className="reel"><div className="strip" ref={strips[0]} /></div>
              <div className="reel"><div className="strip" ref={strips[1]} /></div>
              <div className="reel"><div className="strip" ref={strips[2]} /></div>
              <div className="glass" />
            </div>
          </div>
          <p className={`mt-3 min-h-[26px] text-center font-display text-xl font-semibold uppercase tracking-[0.08em] ${
            tone === 'win' ? 'text-primary' : tone === 'lose' ? 'text-muted-foreground' : ''
          }`}>{result}</p>
        </div>

        <div className="flex flex-col gap-3">
          {locked ? (
            <p className="border border-border bg-board p-4 text-center font-display text-3xl font-semibold uppercase">Come back tomorrow</p>
          ) : outOfTries ? (
            <p className="border border-border bg-board p-4 text-center font-display text-2xl font-semibold uppercase">No spins left until 12:00 GMT</p>
          ) : null}
          <div className="border border-border bg-board p-3">
            <label className="mb-2 block font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase" htmlFor="slot-bet">Bet amount</label>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="font-mono text-muted-foreground">$</span>
              <input
                id="slot-bet"
                type="number"
                inputMode="numeric"
                min={minBet}
                step={50}
                value={bet}
                disabled={spinning || locked || outOfTries}
                onChange={(e) => setBet(Number(e.target.value))}
                onBlur={() => clamp(bet)}
                className="min-w-0 flex-1 border border-border bg-card px-2.5 py-2 font-mono text-base text-primary outline-none focus:border-primary"
              />
              <button type="button" className="cursor-pointer border border-border px-2 py-2 font-mono text-[11px] uppercase" disabled={spinning || locked || outOfTries} onClick={() => clamp(minBet)}>Min</button>
              <button type="button" className="cursor-pointer border border-border px-2 py-2 font-mono text-[11px] uppercase" disabled={spinning || locked || outOfTries} onClick={() => clamp(Math.max(minBet, Math.round(maxBet / 2 / 50) * 50))}>½</button>
              <button type="button" className="cursor-pointer border border-border px-2 py-2 font-mono text-[11px] uppercase" disabled={spinning || locked || outOfTries} onClick={() => clamp(maxBet)}>Max</button>
            </div>
            <button
              type="button"
              className="gloss-gold w-full cursor-pointer px-4 py-3 font-display text-[17px] font-bold tracking-[0.14em] uppercase disabled:cursor-not-allowed disabled:opacity-50"
              disabled={spinning || locked || outOfTries || cash < minBet || left < minBet}
              onClick={() => void spin()}
            >
              Spin
            </button>
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </div>
          <div className="border border-border bg-card">
            <h3 className="border-b border-border px-3.5 py-2.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Winning combinations</h3>
            <table className="w-full border-collapse">
              <tbody>
                {rows.map(([sym, name, mult, note]) => (
                  <tr key={name} className="border-b border-border/60 last:border-0">
                    <td className="px-3.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-6 w-6" dangerouslySetInnerHTML={{ __html: icon(sym) }} />
                        <span className="font-mono text-xs">{name}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2 font-mono text-[11px] text-muted-foreground">{note}</td>
                    <td className="px-3.5 py-2 text-right font-mono text-xs font-semibold text-primary">{mult}× bet</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
