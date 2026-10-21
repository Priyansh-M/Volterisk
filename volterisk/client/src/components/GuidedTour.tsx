import { useEffect, useLayoutEffect, useState } from 'react'
type Step = {
  target: string | null
  title: string
  body: string
  group?: string
}

const GROUP_LABEL: Record<string, string> = {
  overview: 'Overview',
  operations: 'Operations',
  finances: 'Finances & Assets',
  minigames: 'Minigames',
  progression: 'Progression',
  world: 'World',
}

function page(group: string, label: string, to: string, body: string): Step {
  return { target: `nav:${to}`, title: label, body, group }
}

const STEPS: Step[] = [
  {
    target: null,
    title: 'Quick guide',
    body: 'A short walk through the game: where your money is, how heat works, and what every page in the menu does. Open it again any time from Help at the bottom of the menu.',
  },
  {
    target: 'heat',
    title: 'Heat',
    body: 'Heists push this up. Work and time bring it down. Three times a day a heat check can take cash: half above 50, all of it above 100. It resets at 12:00 GMT.',
  },
  {
    target: 'balance',
    title: 'Your money',
    body: 'Cash plus what sits in the vault. Buys, bets and fees come out of cash.',
  },
  page('overview', 'Dashboard', '/', 'Your home screen. Cash, vault, heat and what is ready to claim, at a glance.'),
  page('operations', 'Heists', '/heists', 'Rob a crew or another player. Your weapon faces their vault. Pays big, raises heat.'),
  page('operations', 'Work', '/work', 'Contracts that pay cash and cool heat. The safe first move.'),
  page('operations', 'Bounties', '/bounties', 'Put a price on a player, or hunt one down and claim the purse.'),
  page('finances', 'Vault', '/vault', 'Park cash here so heat checks cannot touch it. Other players can still rob it, so upgrade the door and insurance.'),
  page('finances', 'Marketplace', '/market', 'Weapons, tools, property and cars. Better gear lands better heists.'),
  page('finances', 'Black Market', '/black-market', 'Trade materials, mods and weapons with other players.'),
  page('finances', 'Assets', '/assets', 'Everything you own: property, vehicles and materials.'),
  page('finances', 'Workshop', '/workshop', 'Craft weapon and vault mods from materials. Opens at level 5.'),
  page('progression', 'Arsenal', '/arsenal', 'Your weapons. Repair wear, equip the best one before a heist.'),
  page('progression', 'Reputation', '/reputation', 'Your level. Each one unlocks something new.'),
  page('progression', 'Territory', '/territory', 'From level 11: claim sectors on the map and earn from them.'),
  page('progression', 'Achievements', '/achievements', 'Milestones with cash rewards. A trophy means one is ready to claim.'),
  {
    target: 'minigames',
    title: 'Minigames',
    body: 'Explore various minigames for a chance at extra cash. Each has a daily limit.',
  },
  page('world', 'Map', '/map', 'Every player lives here. Find their bases, scout sectors, and see who holds what before you pick a target.'),
  page('world', 'Profile', '/profile', 'Your public record and history.'),
  page('world', 'Leaderboard', '/leaderboard', 'Where you stand against everyone else.'),
  {
    target: 'notices',
    title: 'Reports',
    body: 'Robberies, payouts and warnings land here. A red count means something needs a look.',
  },
  {
    target: null,
    title: "You're all set",
    body: 'Take a Work contract for safe cash, or go straight for a heist if you feel lucky. Park what you earn in the vault. Help at the bottom of the menu reopens this guide.',
  },
]

const PAD = 6
const CARD_W = 300

type Box = { top: number; left: number; width: number; height: number }

function locate(target: string | null): Box | null {
  if (!target) return null
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0 || r.right <= 0 || r.left >= window.innerWidth) return null
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }
}

function cardPlacement(box: Box) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const gap = 14
  if (box.left + box.width + gap + CARD_W <= vw - 12) {
    const top = Math.min(Math.max(12, box.top), vh - 220)
    return { top, left: box.left + box.width + gap, arrow: 'left' as const, arrowTop: box.top + box.height / 2 - top }
  }
  const left = Math.min(Math.max(12, box.left + box.width - CARD_W), vw - CARD_W - 12)
  return { top: box.top + box.height + gap, left, arrow: 'top' as const, arrowLeft: box.left + box.width / 2 - left }
}

const POLICE_STEP: Step = {
  target: 'heat',
  title: 'Police',
  body: 'From level 11, police attention replaces heat. Holding territory and big hits raise it. High attention brings bounties and confiscations.',
}

export function GuidedTour({
  open,
  late,
  onClose,
  onGroup,
}: {
  open: boolean
  late: boolean
  onClose: () => void
  onGroup: (id: string) => void
}) {
  const [at, setAt] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const step = late && STEPS[at]!.target === 'heat' ? POLICE_STEP : STEPS[at]!
  const last = at === STEPS.length - 1

  useEffect(() => {
    if (open) setAt(0)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    if (step.group) onGroup(step.group)
    const sync = () => setBox(locate(step.target))
    const settle = () => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      el?.scrollIntoView({ block: 'nearest' })
      sync()
    }
    settle()
    const late = window.setTimeout(settle, 300)
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      window.clearTimeout(late)
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onGroup is a fresh closure each render
  }, [open, step.target, step.group])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' && !last) setAt((i) => i + 1)
      if (event.key === 'ArrowLeft') setAt((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, last, onClose])

  if (!open) return null

  const place = box ? cardPlacement(box) : null

  const card = (
    <section
      className="animate-dossier relative border border-primary bg-card p-5 shadow-2xl"
      style={{ width: last ? 'min(560px, calc(100vw - 32px))' : CARD_W }}
      role="dialog"
      aria-label={step.title}
    >
      {place?.arrow === 'left' ? (
        <span
          className="absolute -left-[7px] h-3 w-3 rotate-45 border-b border-l border-primary bg-card"
          style={{ top: Math.min(Math.max(14, place.arrowTop - 6), 180) }}
        />
      ) : null}
      {place?.arrow === 'top' ? (
        <span
          className="absolute -top-[7px] h-3 w-3 rotate-45 border-t border-l border-primary bg-card"
          style={{ left: Math.min(Math.max(14, place.arrowLeft - 6), CARD_W - 26) }}
        />
      ) : null}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.18em] text-primary uppercase">
          {at + 1} of {STEPS.length}
        </p>
        <button
          type="button"
          aria-label="Close help"
          className="-mt-1 -mr-1 cursor-pointer px-1 font-mono text-lg leading-none text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {step.group ? (
        <p className="mt-2 font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">{GROUP_LABEL[step.group]}</p>
      ) : null}
      <h2 className={`${step.group ? 'mt-0.5' : 'mt-2'} font-display text-2xl font-semibold uppercase`}>{step.title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
      <div className="mt-4 flex gap-1">
        {STEPS.map((_, i) => (
          <span key={i} className={`h-1 flex-1 ${i <= at ? 'bg-primary' : 'bg-border'}`} />
        ))}
      </div>
      {last ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="nav-pill cursor-pointer px-3 py-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase"
            onClick={() => setAt((i) => Math.max(0, i - 1))}
          >
            Back
          </button>
          <button
            type="button"
            className="gloss-gold cursor-pointer px-3 py-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase"
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      ) : (
      <div className="mt-4 flex gap-2">
        {at > 0 ? (
          <button
            type="button"
            className="nav-pill flex-1 cursor-pointer px-3 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
            onClick={() => setAt((i) => Math.max(0, i - 1))}
          >
            Back
          </button>
        ) : null}
        <button
          type="button"
          className="gloss-gold flex-1 cursor-pointer px-3 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
          onClick={() => setAt((i) => i + 1)}
        >
          {at === 0 ? 'Start' : 'Next'}
        </button>
      </div>
      )}
    </section>
  )

  return (
    <div className="fixed inset-0 z-[96]">
      {box ? (
        <>
          <div className="absolute inset-0" onClick={(event) => event.stopPropagation()} />
          <div
            className="pointer-events-none absolute border-2 border-primary transition-all duration-200"
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              height: box.height,
              boxShadow: '0 0 0 9999px rgba(8, 6, 3, 0.72), 0 0 18px color-mix(in oklab, var(--color-gold) 55%, transparent)',
            }}
          />
          <div className="absolute" style={{ top: place!.top, left: place!.left }}>
            {card}
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center bg-background/75 p-4">{card}</div>
      )}
    </div>
  )
}
