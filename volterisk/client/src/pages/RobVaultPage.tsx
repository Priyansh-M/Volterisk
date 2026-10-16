import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { IconProperty, IconVault } from '../components/Icons.tsx'

type Phase = 'rules' | 'watch' | 'play' | 'win' | 'caught' | 'disqualified' | 'left' | 'review' | 'none'

export function RobVaultPage() {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const [paidUsed, setPaidUsed] = useState(0)
  const [pays, setPays] = useState(true)
  const [note, setNote] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('rules')
  const [path, setPath] = useState<number[][]>([])
  const [step, setStep] = useState(1)
  const [grid, setGrid] = useState(15)
  const [show, setShow] = useState(false)
  const [miss, setMiss] = useState<[number, number] | null>(null)
  const live = useRef(false)

  useEffect(() => {
    let cancelled = false
    void api<{ chancesLeft: number; paidUsed: number; forfeited: boolean }>('/api/minigames/vault-rob')
      .then((row) => {
        if (cancelled) return
        setPaidUsed(row.paidUsed)
        if (row.forfeited) {
          setNote(null)
          setPhase('left')
          return
        }
        setPhase('rules')
      })
      .catch(() => {
        if (!cancelled) setNote('The desk could not open the job.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function spend() {
      if (!live.current) return
      live.current = false
      void api('/api/minigames/vault-rob/forfeit', { method: 'POST', body: '{}' }).catch(() => undefined)
      setPhase('left')
    }
    function onHide() {
      if (document.visibilityState === 'hidden') spend()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', spend)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', spend)
    }
  }, [])

  async function start(mode: 'normal' | 'hard') {
    try {
      const row = await api<{ path: number[][]; grid: number; paidUsed: number; pays: boolean }>('/api/minigames/vault-rob/start', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      })
      live.current = true
      setPath(row.path)
      setGrid(row.grid)
      setPaidUsed(row.paidUsed)
      setPays(row.pays)
      setStep(1)
      setMiss(null)
      setShow(true)
      setPhase('watch')
      window.setTimeout(() => {
        if (!live.current) return
        setShow(false)
        setPhase('play')
      }, 3000)
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'The run did not start.')
    }
  }

  async function end(kind: 'win' | 'caught' | 'disqualified', steps: number[][]) {
    if (!live.current) return
    live.current = false
    setPhase(kind === 'win' ? 'win' : kind)
    const result = await api<{ ok: boolean; cash: number | null }>('/api/minigames/vault-rob/finish', {
      method: 'POST',
      body: JSON.stringify({ steps }),
    }).catch(() => null)
    if (result?.ok) void refresh()
  }

  function clickCell(r: number, c: number) {
    if (phase !== 'play' || !live.current) return
    if (path.slice(0, step).some(([pr, pc]) => pr === r && pc === c)) return
    const [cr, cc] = path[step - 1]!
    const adjacent = Math.abs(cr - r) + Math.abs(cc - c) === 1
    const [nr, nc] = path[step]!
    if (adjacent && r === nr && c === nc) {
      const next = step + 1
      setStep(next)
      if (next >= path.length) void end('win', path.slice(1))
      return
    }
    void end(adjacent ? 'caught' : 'disqualified', [...path.slice(1, step), [r, c]])
    setMiss([r, c])
  }

  function leave() {
    const running = live.current
    live.current = false
    if (running) void api('/api/minigames/vault-rob/forfeit', { method: 'POST', body: '{}' }).catch(() => undefined)
    navigate('/')
  }

  const onPath = new Set(path.map(([r, c]) => `${r},${c}`))
  const walked = new Set(path.slice(0, step).map(([r, c]) => `${r},${c}`))

  return (
    <div className="relative classified-grid border border-border bg-card p-3 pb-24 sm:p-4">
      {phase === 'review' ? (
        <button type="button" onClick={leave} className="absolute top-3 right-3 z-10 border border-border bg-card px-3 py-2 text-[12px] font-semibold tracking-[0.12em] uppercase">
          Leave game
        </button>
      ) : null}
      <div className="mx-auto mb-3 flex w-full max-w-xs gap-1" aria-label="Paid chances">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-2 flex-1 ${i < paidUsed ? 'bg-primary' : 'bg-border'}`} />
        ))}
      </div>
      <p className="px-1 text-center text-sm leading-5 text-muted-foreground">Walk the leaked route, one step at a time to reach the prize.</p>
      <p className="mt-1 text-center font-mono text-[12px] text-primary">
        {paidUsed >= 4 ? 'Practice. No payout.' : `${4 - paidUsed} paid chance${4 - paidUsed === 1 ? '' : 's'} left`}
      </p>
      {note ? <p className="mt-2 text-center text-sm text-muted-foreground">{note}</p> : null}
      <div
        className="mx-auto mt-3 grid w-full max-w-[min(100%,calc(100dvh-15rem))] gap-[2px] border-2 border-primary bg-background p-1.5 sm:gap-[3px] sm:p-2"
        style={{ gridTemplateColumns: `repeat(${grid}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: grid * grid }, (_, i) => {
          const r = Math.floor(i / grid)
          const c = i % grid
          const key = `${r},${c}`
          const reveal = phase === 'caught' || phase === 'disqualified' || phase === 'review'
          const green = (show && onPath.has(key)) || (reveal && onPath.has(key)) || (!show && !reveal && phase !== 'watch' && walked.has(key) && step > 0 && path.length > 0)
          const wrong = miss?.[0] === r && miss?.[1] === c
          return (
            <button
              key={key}
              type="button"
              disabled={phase !== 'play'}
              onClick={() => clickCell(r, c)}
              className={`relative flex aspect-square min-h-0 touch-manipulation items-center justify-center border ${
                green ? 'border-[#3dae58] bg-[#2f8f45]' : 'border-border bg-card'
              } ${r === 0 && c === 0 && !wrong ? 'outline outline-1 outline-primary' : ''} ${
                r === grid - 1 && c === grid - 1 && !wrong ? 'outline outline-1 outline-foreground' : ''
              } ${wrong ? 'outline outline-2 outline-offset-1 outline-primary' : ''}`}
            >
              {r === 0 && c === 0 ? <IconProperty className="h-[70%] w-[70%] text-primary" /> : null}
              {r === grid - 1 && c === grid - 1 ? <IconVault className="h-[78%] w-[78%] text-primary" /> : null}
            </button>
          )
        })}
      </div>

      {phase === 'rules' || phase === 'none' ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-background/80 p-4">
          <section className="w-full max-w-lg border border-primary bg-card p-5 shadow-2xl">
            <p className="font-mono text-[12px] tracking-[0.16em] text-primary uppercase">Minigames</p>
            <h2 className="mt-2 font-display text-3xl font-semibold uppercase">Rob the Vault</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Pick a board. The route flashes green for 3 seconds. Walk from the gold corner to the white corner. The first four clears today pay $2,500 each, on either board. After that you can keep playing for no payout. Paid chances reset at 12:00 GMT.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" className="border border-primary bg-background p-3 text-left" onClick={() => void start('normal')}>
                <span className="block font-display text-2xl font-semibold uppercase">Normal</span>
                <span className="mt-1 block text-xs text-muted-foreground">10 by 10</span>
                <Preview size={10} />
              </button>
              <button type="button" className="border border-primary bg-background p-3 text-left" onClick={() => void start('hard')}>
                <span className="block font-display text-2xl font-semibold uppercase">Hard</span>
                <span className="mt-1 block text-xs text-muted-foreground">15 by 15</span>
                <Preview size={15} />
              </button>
            </div>
            <button type="button" className="mt-4 w-full border border-border px-4 py-3 text-[12px] font-semibold tracking-[0.14em] uppercase" onClick={() => navigate('/')}>
              Return to dashboard
            </button>
          </section>
        </div>
      ) : null}

      {phase === 'caught' || phase === 'disqualified' || phase === 'left' ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/75 p-4">
          <section className="relative w-full max-w-sm border-2 border-primary bg-card px-6 py-6 text-center shadow-2xl">
            <button type="button" aria-label="Close" className="absolute top-2 right-3 font-mono text-lg text-muted-foreground" onClick={() => setPhase('review')}>
              ×
            </button>
            <svg className="mx-auto" width="56" height="66" viewBox="0 0 72 84" aria-hidden="true">
              <ellipse cx="36" cy="28" rx="16" ry="15" fill="#f3e6d0" />
              <path d="M20 22c2-12 30-12 32 0v6H20z" fill="#1d3557" />
              <rect x="22" y="16" width="28" height="6" fill="#1d3557" />
              <circle cx="30" cy="28" r="2" fill="#1a140c" />
              <circle cx="42" cy="28" r="2" fill="#1a140c" />
              <path d="M16 46h40l-4 28H20z" fill="#1d3557" />
              <rect x="30" y="50" width="12" height="16" fill="#c6a15a" />
            </svg>
            <h2 className="mt-3 font-display text-2xl font-semibold uppercase">The police caught you</h2>
            <div className="mt-5 flex gap-2">
              <button type="button" className="gloss-gold flex-1 cursor-pointer px-3 py-3 text-[12px] font-semibold tracking-[0.14em] uppercase" onClick={() => { setMiss(null); setPhase('rules') }}>
                Continue
              </button>
              <button type="button" className="flex-1 border border-border bg-background px-3 py-3 text-[12px] font-semibold tracking-[0.14em] uppercase" onClick={leave}>
                Leave game
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {phase === 'win' ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/75 p-4">
          <section className="relative w-full max-w-sm border-2 border-primary bg-card px-6 py-6 text-center shadow-2xl">
            <button type="button" aria-label="Close" className="absolute top-2 right-3 font-mono text-lg text-muted-foreground" onClick={() => setPhase('rules')}>
              ×
            </button>
            <h2 className="font-display text-2xl font-semibold uppercase">Congratulations</h2>
            <p className="mt-2 text-sm text-muted-foreground">{pays ? '$2,500 deposited.' : 'No payout in these turns.'}</p>
            <div className="mt-5 flex gap-2">
              <button type="button" className="gloss-gold flex-1 cursor-pointer px-3 py-3 text-[12px] font-semibold tracking-[0.14em] uppercase" onClick={() => setPhase('rules')}>
                New game
              </button>
              <button type="button" className="flex-1 border border-border bg-background px-3 py-3 text-[12px] font-semibold tracking-[0.14em] uppercase" onClick={leave}>
                Leave game
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {phase === 'watch' || phase === 'play' ? (
        <button
          type="button"
          onClick={leave}
          className="fixed bottom-3 left-1/2 z-[90] w-[min(92vw,24rem)] -translate-x-1/2 border border-border bg-card px-4 py-3 text-[12px] font-semibold tracking-[0.14em] uppercase"
        >
          Leave game
        </button>
      ) : null}
    </div>
  )
}

function Preview({ size }: { size: number }) {
  const cells = new Set<string>()
  for (let i = 0; i < size; i++) cells.add(`${i},${Math.min(i, size - 1)}`)
  return (
    <span className="mt-3 grid gap-px" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
      {Array.from({ length: size * size }, (_, i) => {
        const r = Math.floor(i / size)
        const c = i % size
        const on = cells.has(`${r},${c}`)
        return <span key={i} className={`aspect-square ${on ? 'bg-[#2f8f45]' : 'bg-card'}`} />
      })}
    </span>
  )
}
