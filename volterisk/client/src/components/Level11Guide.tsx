import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { load } from '../lib/api.ts'
import { money } from '../lib/format.ts'

const KEY = 'volterisk-l11-guide'
const DONE_KEY = 'volterisk-l11-guide-done'
export type L11GuideStep = 'pick' | 'map' | 'entails' | 'done'

export function setL11Guide(step: L11GuideStep) {
  if (step === 'done') {
    localStorage.setItem(DONE_KEY, '1')
    sessionStorage.setItem(KEY, 'done')
  } else {
    if (localStorage.getItem(DONE_KEY) === '1') return
    sessionStorage.setItem(KEY, step)
  }
  window.dispatchEvent(new Event('volterisk-l11-guide'))
}

export function peekL11Guide(): L11GuideStep | null {
  if (localStorage.getItem(DONE_KEY) === '1') return null
  const v = sessionStorage.getItem(KEY)
  return v === 'pick' || v === 'map' || v === 'entails' || v === 'done' ? v : null
}

/** Centered level 11 briefings — one flashcard at a time. Skips once a sector is held or the guide was finished. */
export function Level11Guide() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<L11GuideStep | null>(() => peekL11Guide())
  const [hasSector, setHasSector] = useState(false)

  useEffect(() => {
    function sync() {
      setStep(peekL11Guide())
    }
    sync()
    window.addEventListener('volterisk-l11-guide', sync)
    return () => window.removeEventListener('volterisk-l11-guide', sync)
  }, [location.pathname, me?.level])

  useEffect(() => {
    if (!me || me.level < 11) return
    let cancelled = false
    load<{ usedSectors?: number; holdings?: unknown[] }>('/api/territory')
      .then((board) => {
        if (cancelled) return
        const held = (board.usedSectors ?? 0) > 1 || (board.holdings?.length ?? 0) > 0
        setHasSector(held)
        if (held) {
          localStorage.setItem(DONE_KEY, '1')
          sessionStorage.setItem(KEY, 'done')
          setStep(null)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [me])

  useEffect(() => {
    if (!me || me.level < 11) return
    if (localStorage.getItem(DONE_KEY) === '1') return
    if (hasSector) return
    if (peekL11Guide()) return
    if (sessionStorage.getItem('volterisk-l11-auto') === '1') return
    sessionStorage.setItem('volterisk-l11-auto', '1')
    setL11Guide('pick')
    setStep('pick')
  }, [me, hasSector])

  if (!step || step === 'done' || step === 'map') return null

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-background/75 p-4">
      <section className="animate-dossier w-full max-w-md border border-primary bg-card p-8 text-center shadow-2xl">
        {step === 'pick' ? (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Level 11</p>
            <h2 className="mt-3 font-display text-3xl font-semibold uppercase">Scout a sector</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Tap any empty square on the map and press Scout territory. Keep {money(500_000)} in the vault. Then Claim on
              Territory and lock Industrial or Financial.
            </p>
            <button
              type="button"
              className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
              onClick={() => {
                setL11Guide('map')
                setStep('map')
                navigate('/map?expand=1')
              }}
            >
              Open the map
            </button>
            <button
              type="button"
              className="nav-pill mt-2 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
              onClick={() => {
                setL11Guide('done')
                setStep(null)
              }}
            >
              Later
            </button>
          </>
        ) : (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Level 11 brief</p>
            <h2 className="mt-3 font-display text-3xl font-semibold uppercase">What you unlocked</h2>
            <ul className="mt-4 space-y-2 text-left text-sm leading-relaxed text-muted-foreground">
              <li>Scout → Claim any empty sector. Extra holdings show purple on the map (no vault, not heistable).</li>
              <li>One-time Industrial or Financial lock after claim.</li>
              <li>Hold {money(500_000)}+ vault · credit card shop · diamond yield.</li>
            </ul>
            <button
              type="button"
              className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
              onClick={() => {
                setL11Guide('done')
                setStep(null)
                if (location.pathname !== '/territory') navigate('/territory')
              }}
            >
              Open Territory
            </button>
          </>
        )}
      </section>
    </div>
  )
}
