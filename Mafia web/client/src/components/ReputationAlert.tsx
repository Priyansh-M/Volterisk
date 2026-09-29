import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { money } from '../lib/format.ts'

type Offer = { nextLevel: number; reward: number }

function seenKey(level: number) {
  return `blackledger-rep-seen-${level}`
}

export function ReputationAlert() {
  const navigate = useNavigate()
  const location = useLocation()
  const [offer, setOffer] = useState<Offer | null>(null)

  useEffect(() => {
    let cancelled = false
    async function look() {
      try {
        const file = await api<{ ready: boolean; nextLevel: number | null; reward: number | null }>('/api/reputation')
        if (cancelled || !file.ready || file.nextLevel == null || file.reward == null) return
        if (sessionStorage.getItem(seenKey(file.nextLevel))) return
        setOffer({ nextLevel: file.nextLevel, reward: file.reward })
      } catch {
        /* the desk will try again */
      }
    }
    void look()
    const timer = window.setInterval(() => void look(), 8000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [location.pathname])

  if (!offer) return null

  function open() {
    sessionStorage.setItem(seenKey(offer!.nextLevel), '1')
    setOffer(null)
    if (location.pathname !== '/reputation') navigate('/reputation')
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-background/80 p-4">
      <section className="animate-dossier w-full max-w-md border border-primary bg-card p-8 text-center shadow-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Standing</p>
        <h2 className="mt-3 font-display text-4xl font-semibold uppercase">You have reached level {offer.nextLevel}</h2>
        <p className="mt-4 text-sm text-muted-foreground">The conditions are met. Claim {money(offer.reward)} on the reputation desk.</p>
        <button type="button" className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={open}>
          {location.pathname === '/reputation' ? 'Claim it here' : 'Open reputation'}
        </button>
      </section>
    </div>
  )
}
