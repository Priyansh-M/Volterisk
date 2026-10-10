import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setL11Guide } from '../components/Level11Guide.tsx'
import { Btn, Notice } from '../components/ui.tsx'
import { ApiError, api, load } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

type Reputation = {
  level: number
  maxLevel: number
  title?: string
  phase?: string
  nextLevel: number | null
  nextTitle?: string | null
  reward: number | null
  fee: number | null
  unlocks?: string[]
  milestone?: boolean
  ready: boolean
  conditionsReady?: boolean
  canPayFee?: boolean
  met: number
  total: number
  cash: number
  conditions: { id: string; label: string; met: boolean }[]
}

export function ReputationPage() {
  const { refresh, applyCash } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState<Reputation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shift, setShift] = useState(false)
  const [l11Claimed, setL11Claimed] = useState(false)
  const [levelPopup, setLevelPopup] = useState<{
    level: number
    title: string
    reward: number
    unlocks: string[]
  } | null>(null)
  type CareerFile = {
    primary: { id: string; label: string; blurb: string } | null
    secondary: { id: string; label: string; blurb: string } | null
    secondaryUnlocked: boolean
    switchPrimaryFee: number
    switchSecondaryFee: number
    cooldownMs: number
    canSwitchPrimary: boolean
    firstPickFree: boolean
    options: { id: string; label: string; blurb: string }[]
  }
  const [career, setCareer] = useState<CareerFile | null>(null)

  async function reload() {
    const [data, careerData] = await Promise.all([
      load<Reputation>('/api/reputation'),
      load<CareerFile>('/api/career'),
    ])
    setFile(data)
    setCareer(careerData)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'The standing did not load.'))
  }, [])

  async function pickCareer(careerId: string, which: 'primary' | 'secondary') {
    setBusy(true)
    setError(null)
    try {
      const path = which === 'primary' ? '/api/career/primary' : '/api/career/secondary'
      const next = await api<CareerFile & { cash: number }>(path, { method: 'POST', body: JSON.stringify({ careerId }) })
      setCareer(next)
      applyCash(next.cash)
      void refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Career change failed.')
    } finally {
      setBusy(false)
    }
  }

  async function claim() {
    if (!file?.ready) return
    const claimingEleven = file.nextLevel === 11
    const pendingReward = file.reward ?? 0
    const pendingUnlocks = file.unlocks ?? []
    const pendingTitle = file.nextTitle ?? ''
    const pendingLevel = file.nextLevel
    setBusy(true)
    setError(null)
    try {
      const paid = await api<Reputation>('/api/reputation/claim', { method: 'POST', body: '{}' })
      applyCash(paid.cash)
      setShift(true)
      setFile(paid)
      setNote(`Level ${paid.level} is on your file.`)
      void refresh()
      window.setTimeout(() => setShift(false), 700)
      if (claimingEleven) {
        setL11Guide('pick')
        setL11Claimed(true)
      } else if (pendingLevel != null) {
        setLevelPopup({
          level: paid.level,
          title: paid.title ?? pendingTitle,
          reward: pendingReward,
          unlocks: pendingUnlocks,
        })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The claim did not go through.')
    } finally {
      setBusy(false)
    }
  }

  const left = file?.level ?? 1
  const right = file?.nextLevel
  const progress = !file ? 0 : file.total === 0 ? 100 : Math.round((file.met / file.total) * 100)

  return (
    <div className="flex flex-col gap-4">
      <section className={`border border-primary/40 bg-card px-4 py-3 ${shift ? 'rep-shift' : ''}`}>
        <div className="mb-2 flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">From</p>
            <p className="rep-label font-display text-2xl font-semibold uppercase">Level {left}</p>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">{file ? (file.total === 0 ? 'Standing complete' : `${file.met} / ${file.total}`) : '—'}</p>
          <div className="text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{right ? 'To' : 'Cap'}</p>
            <p className="rep-label font-display text-2xl font-semibold uppercase text-primary">{right ? `Level ${right}` : 'Held'}</p>
          </div>
        </div>
        <div className="relative h-1.5 overflow-hidden bg-background">
          <div className="rep-bar-fill h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </section>

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {note ? <Notice tone="ok">{note}</Notice> : null}
      {!file && !error ? <Notice tone="muted">Reading the ladder…</Notice> : null}

      {l11Claimed ? (
        <div className="fixed inset-0 z-[88] flex items-center justify-center bg-background/75 p-4">
          <section className="animate-dossier w-full max-w-md border border-primary bg-card p-8 text-center shadow-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Level 11 claimed</p>
            <h2 className="mt-3 font-display text-3xl font-semibold uppercase">Scout a sector</h2>
            <p className="mt-4 text-sm text-muted-foreground">Open the map and scout any empty square.</p>
            <button
              type="button"
              className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
              onClick={() => {
                setL11Claimed(false)
                setL11Guide('map')
                navigate('/map?expand=1')
              }}
            >
              Open the map
            </button>
          </section>
        </div>
      ) : null}

      {levelPopup ? (
        <div className="fixed inset-0 z-[88] flex items-center justify-center bg-background/75 p-4">
          <section className="animate-dossier w-full max-w-md border border-primary bg-card p-8 text-center shadow-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Level {levelPopup.level}</p>
            <h2 className="mt-3 font-display text-3xl font-semibold uppercase">{levelPopup.title}</h2>
            {levelPopup.reward > 0 ? (
              <p className="mt-4 text-sm text-foreground">Level-up reward {money(levelPopup.reward)}</p>
            ) : null}
            {levelPopup.unlocks.length > 0 ? (
              <ul className="mt-4 space-y-1 text-left text-sm text-muted-foreground">
                {levelPopup.unlocks.map((row) => (
                  <li key={row}>· {row}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
              onClick={() => setLevelPopup(null)}
            >
              Continue
            </button>
          </section>
        </div>
      ) : null}

      {file ? (
        <section className="border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Current standing</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl font-semibold uppercase">Level {file.level}</h2>
              {file.title ? <p className="mt-1 text-sm text-muted-foreground">{file.title}{file.phase ? ` · ${file.phase}` : ''}</p> : null}
            </div>
            {file.ready && file.reward != null ? (
              <Btn variant="gold" disabled={busy} onClick={() => void claim()}>
                {busy
                  ? 'Claiming…'
                  : file.fee && file.fee > 0
                    ? `Claim level ${file.nextLevel} · fee ${money(file.fee)}`
                    : file.reward > 0
                      ? `Claim ${money(file.reward)}`
                      : `Claim level ${file.nextLevel}`}
              </Btn>
            ) : null}
          </div>
          {file.nextLevel === 11 && file.fee ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Level 11 fee {money(file.fee)} from cash · $0 reward · requires Diamond Vault Level 5 · unlocks Territory, vault credit card, diamond yield.
              {!file.canPayFee ? ` You have ${money(file.cash)}.` : null}
            </p>
          ) : null}
          {file.nextLevel != null && file.nextLevel >= 12 && file.reward != null ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Next: Level {file.nextLevel}
              {file.nextTitle ? ` · ${file.nextTitle}` : ''}
              {file.milestone ? ' · milestone' : ''}
              {' · '}level-up reward {money(file.reward)}
              {file.unlocks && file.unlocks.length > 0 ? ` · unlocks ${file.unlocks.join(', ')}` : ''}
            </p>
          ) : null}
          <h3 className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Conditions for next level</h3>
          {file.conditions.length === 0 ? (
            <p className="mt-4 text-lg text-muted-foreground">Level {file.maxLevel} is the top of the ladder.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border border border-border">
              {file.conditions.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-3 py-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[10px] ${
                      row.met ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {row.met ? '✓' : ''}
                  </span>
                  <span className={`text-sm leading-snug ${row.met ? 'text-foreground' : 'text-muted-foreground'}`}>{row.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {career && file && file.level >= 11 ? (
        <section className="border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Career</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Primary: {career.primary ? `${career.primary.label} — ${career.primary.blurb}` : 'Not chosen'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Secondary:{' '}
            {career.secondaryUnlocked
              ? career.secondary
                ? `${career.secondary.label} (half strength)`
                : 'Open'
              : `Unlocks at level ${30}`}
          </p>
          {!career.canSwitchPrimary && career.cooldownMs > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Primary switch cooldown: {Math.ceil(career.cooldownMs / 3_600_000)}h
            </p>
          ) : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {career.options.map((opt) => (
              <div key={opt.id} className="border border-border p-3">
                <p className="font-display text-sm font-semibold uppercase">{opt.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opt.blurb}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn
                    disabled={busy || (!career.firstPickFree && !career.canSwitchPrimary) || career.primary?.id === opt.id}
                    onClick={() => void pickCareer(opt.id, 'primary')}
                  >
                    {career.primary?.id === opt.id
                      ? 'Primary'
                      : career.firstPickFree
                        ? 'Choose'
                        : `Switch ${money(career.switchPrimaryFee)}`}
                  </Btn>
                  {career.secondaryUnlocked && career.primary?.id !== opt.id ? (
                    <Btn
                      disabled={busy || career.secondary?.id === opt.id}
                      onClick={() => void pickCareer(opt.id, 'secondary')}
                    >
                      {career.secondary?.id === opt.id ? 'Secondary' : `Secondary ${money(career.switchSecondaryFee)}`}
                    </Btn>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="pt-2 text-sm text-muted-foreground">
        This is the level on your file. The job application needs it. Everyone starts at level 1.
      </p>
    </div>
  )
}
