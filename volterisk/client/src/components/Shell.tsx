import { Fragment, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LedgerAlerts } from './LedgerAlerts.tsx'
import { Portrait } from './Portrait.tsx'
import { Level11Guide } from './Level11Guide.tsx'
import { ReputationAlert } from './ReputationAlert.tsx'
import { SoftToast } from './SoftToast.tsx'
import { api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, remaining } from '../lib/format.ts'
import type { GameNotice } from '../lib/types.ts'
import {
  IconArsenal,
  IconBoard,
  IconChevronDown,
  IconCoins,
  IconContract,
  IconCrosshair,
  IconEye,
  IconGlobe,
  IconHeist,
  IconHome,
  IconLayers,
  IconMap,
  IconMarket,
  IconOps,
  IconPin,
  IconProfile,
  IconProperty,
  IconRank,
  IconSeal,
  IconSignal,
  IconSteps,
  IconTool,
  IconVault,
} from './Icons.tsx'

type NavItem = { to: string; label: string; end?: boolean; Icon: typeof IconHome; casino?: boolean }

type NavGroup = { id: string; label: string; Icon: typeof IconHome; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    Icon: IconLayers,
    items: [{ to: '/', label: 'Dashboard', end: true, Icon: IconHome }],
  },
  {
    id: 'operations',
    label: 'Operations',
    Icon: IconOps,
    items: [
      { to: '/heists', label: 'Heists', Icon: IconHeist },
      { to: '/work', label: 'Work', Icon: IconContract },
      { to: '/bounties', label: 'Bounties', Icon: IconCrosshair },
    ],
  },
  {
    id: 'finances',
    label: 'Finances & Assets',
    Icon: IconCoins,
    items: [
      { to: '/vault', label: 'Vault', Icon: IconVault },
      { to: '/market', label: 'Marketplace', Icon: IconMarket },
      { to: '/black-market', label: 'Black Market', Icon: IconEye },
      { to: '/assets', label: 'Assets', Icon: IconProperty },
      { to: '/workshop', label: 'Workshop', Icon: IconTool },
      { to: '/casino/roulette', label: 'Casino', Icon: IconBoard, casino: true },
    ],
  },
  {
    id: 'progression',
    label: 'Progression',
    Icon: IconSteps,
    items: [
      { to: '/arsenal', label: 'Arsenal', Icon: IconArsenal },
      { to: '/reputation', label: 'Reputation', Icon: IconRank },
      { to: '/territory', label: 'Territory', Icon: IconPin },
      { to: '/achievements', label: 'Achievements', Icon: IconSeal },
    ],
  },
  {
    id: 'world',
    label: 'World',
    Icon: IconGlobe,
    items: [
      { to: '/map', label: 'Map', Icon: IconMap },
      { to: '/profile', label: 'Profile', Icon: IconProfile },
      { to: '/leaderboard', label: 'Leaderboard', Icon: IconBoard },
    ],
  },
]

/** Matches server WORKSHOP.MIN_REPUTATION. */
const WORKSHOP_MIN_REPUTATION = 5

const pageMeta: Record<string, [string, string]> = {
  '/': ['Operations Center', 'Live overview of your network, assets, and opportunities.'],
  '/heists': ['Heist Intelligence', 'Evaluate targets, exposure, and operational risk.'],
  '/heat': ['Heat', 'Crime raises it. Work and time bring it down.'],
  '/vault': ['Vault Facility', 'Secure capital and improve protection systems.'],
  '/arsenal': ['Classified Arsenal', 'Inspect and manage registered equipment.'],
  '/market': ['Marketplace', 'Tools, property, and automobiles.'],
  '/black-market': ['Black Market', 'Player listings for materials, modifications, and weapons.'],
  '/assets': ['Assets', 'Properties, vehicles, and materials you hold.'],
  '/workshop': ['Workshop', 'Craft modifications from materials. Recipes unlock by workshop level.'],
  '/properties': ['Assets', 'Properties and vehicles you already hold.'],
  '/work': ['Contract Board', 'Select underground work by reward, risk, and location.'],
  '/reputation': ['Reputation', ''],
  '/territory': ['Territory', 'Expand any empty sector after level 11. Hold vault capital. Track police attention.'],
  '/map': ['World Intelligence', 'Monitor territories and inspect the network.'],
  '/achievements': ['Accomplishments', 'Archived milestones, sealed cases, and distinctions.'],
  '/profile': ['Identity Dossier', 'Your public record, reputation, and operating history.'],
  '/leaderboard': ['Intelligence Ranking', 'Current standing across the criminal network.'],
  '/casino/roulette': ['Roulette', 'European wheel. Cash only. Five percent of the total.'],
  '/bounties': ['Bounty Board', 'Post cash contracts. Start a hunt, heist the mark, claim the purse.'],
  '/notifications': ['Incoming Reports', 'Security alerts and operational updates.'],
}

function CashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export function Shell() {
  const { me, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notices, setNotices] = useState(0)
  const [unclaimed, setUnclaimed] = useState(me?.unclaimedAchievements ?? 0)
  const [welcome, setWelcome] = useState(false)
  const [brief, setBrief] = useState(false)
  const [discordInvite, setDiscordInvite] = useState(false)
  const [workshopGate, setWorkshopGate] = useState(false)
  const [heatWarn, setHeatWarn] = useState<string | null>(null)
  const [heatWarnClosed, setHeatWarnClosed] = useState<string | null>(null)
  const [casinoOpen, setCasinoOpen] = useState(location.pathname.startsWith('/casino'))
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const g of navGroups) initial[g.id] = false
    const saved = localStorage.getItem('volterisk-nav-open')
    if (saved && navGroups.some((g) => g.id === saved)) {
      initial[saved] = true
    } else {
      initial.overview = true
    }
    return initial
  })
  const groupOpenRef = useRef(groupOpen)
  groupOpenRef.current = groupOpen
  const navAnimRef = useRef<number | null>(null)
  const NAV_DROP_MS = 230

  function clearNavAnim() {
    if (navAnimRef.current != null) {
      window.clearTimeout(navAnimRef.current)
      navAnimRef.current = null
    }
  }

  function closeAllGroups() {
    const next: Record<string, boolean> = {}
    for (const g of navGroups) next[g.id] = false
    setGroupOpen(next)
    localStorage.removeItem('volterisk-nav-open')
  }

  function openGroupNow(id: string) {
    const next: Record<string, boolean> = {}
    for (const g of navGroups) next[g.id] = g.id === id
    setGroupOpen(next)
    localStorage.setItem('volterisk-nav-open', id)
  }

  /** Collapse the open group first, then expand the target (or stay closed). */
  function revealGroup(id: string | null) {
    clearNavAnim()
    const current = navGroups.find((g) => groupOpenRef.current[g.id])?.id ?? null
    if (current === id) return

    if (current) {
      closeAllGroups()
      if (!id) return
      navAnimRef.current = window.setTimeout(() => {
        navAnimRef.current = null
        openGroupNow(id)
      }, NAV_DROP_MS)
      return
    }

    if (id) openGroupNow(id)
  }

  function toggleGroup(id: string) {
    const current = navGroups.find((g) => groupOpenRef.current[g.id])?.id ?? null
    if (current === id) {
      revealGroup(null)
      return
    }
    revealGroup(id)
  }

  useEffect(() => () => clearNavAnim(), [])

  useEffect(() => {
    const match = navGroups.find((g) =>
      g.items.some((item) => {
        if (item.casino) return location.pathname.startsWith('/casino')
        if (item.end) return location.pathname === item.to
        return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
      }),
    )
    if (!match) return
    revealGroup(match.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drive from route only
  }, [location.pathname])

  useEffect(() => {
    if (typeof me?.unclaimedAchievements === 'number') setUnclaimed(me.unclaimedAchievements)
  }, [me?.unclaimedAchievements])

  useEffect(() => {
    if (location.pathname !== '/workshop') return
    if ((me?.level ?? 0) >= WORKSHOP_MIN_REPUTATION) return
    setWorkshopGate(true)
    navigate('/', { replace: true })
  }, [location.pathname, me?.level, navigate])

  useEffect(() => {
    if (location.pathname !== '/') return
    if (sessionStorage.getItem('volterisk-welcome') === '1') {
      setWelcome(true)
      return
    }
    if (sessionStorage.getItem('volterisk-brief') === '1') setBrief(true)
  }, [location.pathname])

  /** First-account intro: 5s between welcome → brief → discord (Continue still works). */
  useEffect(() => {
    if (!welcome || location.pathname !== '/') return
    const t = window.setTimeout(() => {
      sessionStorage.removeItem('volterisk-welcome')
      setWelcome(false)
      if (sessionStorage.getItem('volterisk-brief') === '1') setBrief(true)
    }, 5_000)
    return () => window.clearTimeout(t)
  }, [welcome, location.pathname])

  useEffect(() => {
    if (!brief || welcome || location.pathname !== '/') return
    const t = window.setTimeout(() => {
      sessionStorage.removeItem('volterisk-brief')
      setBrief(false)
    }, 5_000)
    return () => window.clearTimeout(t)
  }, [brief, welcome, location.pathname])

  useEffect(() => {
    if (!me?.id) return
    const seen = localStorage.getItem(`volterisk-discord:${me.id}`) === '1'
    const introOpen =
      welcome ||
      brief ||
      sessionStorage.getItem('volterisk-welcome') === '1' ||
      sessionStorage.getItem('volterisk-brief') === '1'
    if (seen || introOpen) {
      setDiscordInvite(false)
      return
    }
    const t = window.setTimeout(() => setDiscordInvite(true), 5_000)
    return () => window.clearTimeout(t)
  }, [me?.id, welcome, brief])

  useEffect(() => {
    if (!me?.id) return
    let cancelled = false
    async function look() {
      if (document.hidden) return
      try {
        const row = await api<{ active: boolean; token: string | null }>('/api/heat/warning')
        if (!cancelled) setHeatWarn(row.active && row.token ? row.token : null)
      } catch {
        if (!cancelled) setHeatWarn(null)
      }
    }
    void look()
    const timer = window.setInterval(() => void look(), 120_000)
    const onVis = () => {
      if (!document.hidden) void look()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [me?.id])

  function dismissDiscord() {
    if (me?.id) localStorage.setItem(`volterisk-discord:${me.id}`, '1')
    setDiscordInvite(false)
  }

  function recount(count?: number) {
    if (typeof count === 'number') {
      setNotices(count)
      return
    }
    api<{ notifications: GameNotice[] }>('/api/notifications')
      .then((data) => setNotices(data.notifications.filter((row) => row.read !== true).length))
      .catch(() => setNotices(0))
  }

  if (!me) return null
  const heat = me.heat ?? 0
  const heatLabel = heat > 50 ? 'High' : heat > 20 ? 'Medium' : 'Low'
  const meta = pageMeta[location.pathname] ?? ['Volterisk', 'Private network.']
  const stamp = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LedgerAlerts paused={welcome || brief || discordInvite} onChange={recount} onUnclaimed={setUnclaimed} />
      {welcome && location.pathname === '/' ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-background/80 p-4">
          <section className="animate-dossier w-full max-w-lg border border-line bg-ink/90 p-8 shadow-2xl">
            <p className="text-[10px] tracking-[0.28em] text-primary uppercase">Private network</p>
            <h2 className="mt-3 font-display text-3xl font-semibold uppercase">Welcome to Volterisk</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Dominate the leaderboard with three options.</p>
            <dl className="mt-6 space-y-4 text-sm">
              <div className="border-b border-border pb-3">
                <dt className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">Heist</dt>
                <dd className="mt-1 leading-6">Pick a stationed crew or another player. Your weapon faces their vault. The chance is decided on the server, then the take, the heat, and a worn-down weapon are written down.</dd>
              </div>
              <div className="border-b border-border pb-3">
                <dt className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">Work</dt>
                <dd className="mt-1 leading-6">Contracts on the board pay cash and cool heat. A passive job, once you qualify, pays at noon GMT.</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">Casino</dt>
                <dd className="mt-1 leading-6">Try your luck at the casino, use your cash for the chance to win big sums against the house.</dd>
              </div>
            </dl>
            <button
              type="button"
              className="gloss-gold mt-8 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
              onClick={() => {
                sessionStorage.removeItem('volterisk-welcome')
                setWelcome(false)
                if (sessionStorage.getItem('volterisk-brief') === '1') setBrief(true)
              }}
            >
              Continue
            </button>
          </section>
        </div>
      ) : null}
      {brief && !welcome && location.pathname === '/' ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4">
          <section className="animate-dossier w-full max-w-lg border border-primary bg-card p-6 shadow-2xl">
            <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">Before you step onto the chart</p>
            <h2 className="mt-2 font-display text-3xl font-semibold uppercase">Keep the cash in the vault</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              $25,000 is already in your vault. Heat is the number at the top left of the bar. Heists push it up. Work and time bring it down.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Three times a day, a heat check can reach the cash in your pocket. Above 50 it takes half. Above 100 it takes all of it. Money sitting in the vault is not part of that. A warning opens one minute before each check.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The vault can still be robbed, but it has a door, a capacity, and insurance. Loose cash has none of those. Deposit before you go looking for trouble. Buys, bets, and fees come out of pocket cash only.
            </p>
            <button
              type="button"
              className="gloss-gold mt-5 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
              onClick={() => {
                sessionStorage.removeItem('volterisk-brief')
                setBrief(false)
              }}
            >
              I understand
            </button>
          </section>
        </div>
      ) : null}
      {workshopGate ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-background/85 p-4">
          <section className="w-full max-w-md border border-primary bg-card px-5 py-5 shadow-2xl">
            <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">Workshop locked</p>
            <h2 className="mt-2 font-display text-2xl font-semibold uppercase">Access denied</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              Minimum reputation level five to access.
            </p>
            <button
              type="button"
              className="gloss-gold mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
              onClick={() => setWorkshopGate(false)}
            >
              Understood
            </button>
          </section>
        </div>
      ) : null}
      {heatWarn && heatWarn !== heatWarnClosed ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4">
          <section className="animate-dossier relative w-full max-w-lg border border-destructive bg-card p-8 shadow-2xl">
            <button
              type="button"
              className="absolute top-4 right-4 cursor-pointer font-mono text-sm text-muted-foreground hover:text-foreground"
              aria-label="Close"
              onClick={() => setHeatWarnClosed(heatWarn)}
            >
              ×
            </button>
            <p className="font-mono text-[10px] tracking-[0.2em] text-destructive uppercase">Heat check</p>
            <h2 className="mt-3 font-display text-3xl font-semibold uppercase">One minute</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Heat Check incoming, protect your money ASAP.</p>
            <button
              type="button"
              className="nav-pill mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase"
              onClick={() => setHeatWarnClosed(heatWarn)}
            >
              Continue
            </button>
          </section>
        </div>
      ) : null}
      {discordInvite ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-background/80 p-4">
          <section className="animate-dossier relative w-full max-w-lg border border-line bg-ink/90 p-8 shadow-2xl">
            <button
              type="button"
              className="absolute top-4 right-4 cursor-pointer font-mono text-sm text-muted-foreground hover:text-foreground"
              aria-label="Close"
              onClick={dismissDiscord}
            >
              ×
            </button>
            <p className="text-[10px] tracking-[0.28em] text-primary uppercase">Private network</p>
            <h2 className="mt-3 font-display text-3xl font-semibold uppercase">Join the discord</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Meet your fellow operators.</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">You can always join later from the small Discord icon above Log out.</p>
            <a
              href="https://discord.gg/9H4FtfmBA"
              target="_blank"
              rel="noreferrer"
              className="gloss-gold mt-8 block w-full cursor-pointer px-4 py-2 text-center text-[11px] font-semibold tracking-[0.16em] uppercase no-underline"
              onClick={dismissDiscord}
            >
              Join
            </a>
          </section>
        </div>
      ) : null}
      <ReputationAlert />
      <Level11Guide />
      <SoftToast />
      {mobileOpen ? (
        <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-background/75 lg:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${collapsed ? 'lg:w-[76px]' : 'lg:w-64'}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <NavLink to="/" className="flex min-w-0 items-center gap-3 text-left no-underline" onClick={() => setMobileOpen(false)}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-primary font-display text-lg font-bold text-primary">B</span>
            {collapsed ? null : (
              <span>
                <span className="block font-display text-lg font-semibold uppercase leading-none text-foreground">Volterisk</span>
                <span className="font-mono text-[8px] uppercase text-muted-foreground">Private network</span>
              </span>
            )}
          </NavLink>
          <button type="button" className="font-mono text-[10px] uppercase text-muted lg:hidden" onClick={() => setMobileOpen(false)}>
            Close
          </button>
        </div>
        <div className={`border-b border-sidebar-border p-4 ${collapsed ? 'lg:px-3' : ''}`}>
          <div className="flex items-center gap-3">
            <Portrait name={me.username} url={me.avatarUrl} className="h-9 w-9 shrink-0 border border-border bg-card text-sm" />
            {collapsed ? null : (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{me.username}</p>
                <p className="font-mono text-[9px] uppercase text-primary">
                  {me.title} · Level {me.level}
                </p>
              </div>
            )}
          </div>
          {collapsed ? null : (
            <div className="mt-4 flex justify-between border-t border-sidebar-border pt-3">
              <span>
                <small className="block font-mono text-[8px] uppercase text-muted-foreground">
                  {me.vaultCreditCard ? 'Card' : 'Cash'}
                </small>
                <b className="font-mono text-xs">
                  {money(me.vaultCreditCard ? me.vault.balance : me.cash)}
                </b>
              </span>
              <span className="text-right">
                <small className="block font-mono text-[8px] uppercase text-muted-foreground">Location</small>
                <b className="font-mono text-xs">{me.base ? me.base.name?.trim() || 'Unnamed' : 'Unplaced'}</b>
              </span>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {navGroups.map((group) => {
            const open = collapsed || !!groupOpen[group.id]
            const groupActive = group.items.some((item) =>
              item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
            )
            const itemPad = collapsed ? 'px-3' : 'pl-10 pr-3'
            return (
              <div key={group.id} className="mb-0.5">
                {collapsed ? null : (
                  <button
                    type="button"
                    className={`mb-0.5 flex h-9 w-full items-center gap-3 border-l-2 px-3 text-left text-xs ${
                      groupActive
                        ? 'border-primary bg-accent text-foreground'
                        : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <group.Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{group.label}</span>
                    <IconChevronDown
                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out ${open ? 'rotate-0' : '-rotate-90'}`}
                    />
                  </button>
                )}
                <div className={`nav-drop ${open ? 'nav-drop-open' : ''}`}>
                  <div className="nav-drop-inner">
                    {group.items.map((link) => {
                      if (link.casino) {
                        return (
                          <Fragment key={link.to}>
                            <button
                              type="button"
                              className={`mb-0.5 flex h-9 w-full items-center gap-3 border-l-2 text-left text-xs ${itemPad} ${
                                location.pathname.startsWith('/casino')
                                  ? 'border-primary bg-accent text-foreground'
                                  : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                              }`}
                              onMouseEnter={() => void import('../pages/RoulettePage.tsx')}
                              onClick={() => setCasinoOpen((v) => !v)}
                            >
                              <CashIcon className="h-4 w-4 shrink-0" />
                              {collapsed ? null : <span className="flex-1">Casino</span>}
                              {collapsed ? null : (
                                <IconChevronDown
                                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out ${casinoOpen ? 'rotate-0' : '-rotate-90'}`}
                                />
                              )}
                            </button>
                            <div className={`nav-drop ${casinoOpen && !collapsed ? 'nav-drop-open' : ''}`}>
                              <div className="nav-drop-inner">
                                <NavLink
                                  to="/casino/roulette"
                                  onMouseEnter={() => void import('../pages/RoulettePage.tsx')}
                                  onClick={() => setMobileOpen(false)}
                                  className={({ isActive }) =>
                                    `mb-0.5 flex h-9 items-center gap-3 border-l-2 pl-16 pr-3 text-left text-xs no-underline ${
                                      isActive
                                        ? 'border-primary text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`
                                  }
                                >
                                  Roulette
                                </NavLink>
                              </div>
                            </div>
                          </Fragment>
                        )
                      }
                      return (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          end={link.end}
                          title={collapsed ? link.label : undefined}
                          /* Prefetch on click path only — hover warm was opening extra isolates. */
                          onClick={(event) => {
                            if (link.to === '/workshop' && (me?.level ?? 0) < WORKSHOP_MIN_REPUTATION) {
                              event.preventDefault()
                              setWorkshopGate(true)
                              setMobileOpen(false)
                              return
                            }
                            setMobileOpen(false)
                          }}
                          className={({ isActive }) =>
                            `mb-0.5 flex h-9 w-full items-center gap-3 border-l-2 text-left text-xs no-underline ${itemPad} ${
                              isActive
                                ? 'border-primary bg-accent text-foreground'
                                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`
                          }
                        >
                          <link.Icon className="h-4 w-4 shrink-0" />
                          {collapsed ? null : <span>{link.label}</span>}
                          {!collapsed && link.to === '/achievements' && unclaimed > 0 ? (
                            <span className="ml-auto text-primary" title="Reward ready to claim">
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                                <path d="M7 4h10v2a5 5 0 0 1-4 4.9V14h3v2H8v-2h3v-3.1A5 5 0 0 1 7 6V4zm-3 1h2v2a3 3 0 0 0 1.2 2.4A4 4 0 0 1 4 6V5zm16 0v1a4 4 0 0 1-3.2 3.4A3 3 0 0 0 18 7V5h2zM9 18h6v2H9v-2z" />
                              </svg>
                            </span>
                          ) : null}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <a
            href="https://discord.gg/9H4FtfmBA"
            target="_blank"
            rel="noreferrer"
            title="Discord"
            aria-label="Discord"
            className="mb-2 ml-3 inline-flex h-8 w-8 items-center justify-center border border-primary text-muted-foreground hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M19.27 5.33A17.4 17.4 0 0 0 15 4a.1.1 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.1 16.1 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09A.1.1 0 0 0 9 4a17.4 17.4 0 0 0-4.27 1.33c-.01 0-.02.01-.03.02C1.98 9.42 1.23 13.38 1.6 17.3c0 .02.01.04.03.05A17.9 17.9 0 0 0 6.87 20c.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01a17.9 17.9 0 0 0 5.25-2.65c.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02M8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12m6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12" />
            </svg>
          </a>
          <button type="button" className="block px-3 font-mono text-[9px] uppercase text-muted-foreground hover:text-foreground" onClick={() => void logout()}>
            {collapsed ? 'Out' : 'Log out'}
          </button>
        </div>
        <button
          type="button"
          className="absolute -right-4 bottom-5 hidden h-8 w-8 border border-border bg-card text-xs lg:inline-flex lg:items-center lg:justify-center"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </aside>
      <main className={`min-h-screen transition-[margin] ${collapsed ? 'lg:ml-[76px]' : 'lg:ml-64'}`}>
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button type="button" className="border border-border px-2 py-1 font-mono text-[10px] uppercase lg:hidden" onClick={() => setMobileOpen(true)}>
              Menu
            </button>
            <NavLink id="heat-readout" to="/heat" className="flex items-center gap-2 text-xs text-foreground no-underline">
              <span className="text-muted-foreground">Heat</span>
              <b>{me.heat ?? 0}</b>
              <span className={heatLabel === 'High' ? 'text-destructive' : 'text-muted-foreground'}>{heatLabel}</span>
            </NavLink>
            <div className="hidden items-center gap-2 text-xs text-success sm:flex">
              <span className="h-1.5 w-1.5 bg-success" /> Network online
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-5">
            <div className="border-l border-border pl-3 sm:pl-5">
              <span className="block font-mono text-[8px] uppercase text-muted-foreground">
                {me.vaultCreditCard ? 'Card' : 'Total balance'}
              </span>
              <b className="font-mono text-xs">
                {money(me.vaultCreditCard ? me.vault.balance : me.cash + me.vault.balance)}
              </b>
            </div>
            <NavLink to="/notifications" aria-label="Notifications" className="relative text-foreground no-underline" onClick={() => setNotices(0)}>
              <IconSignal className="h-4 w-4" />
              {notices > 0 ? (
                <span className="absolute -top-2 -right-2 min-w-[14px] bg-destructive px-0.5 text-center font-mono text-[8px] leading-[14px] text-white">
                  {notices > 9 ? '9+' : notices}
                </span>
              ) : null}
            </NavLink>
          </div>
        </header>
        {me.penalty?.active ? (
          <div className="border-b border-destructive/50 bg-destructive/15 px-4 py-2 text-center text-sm text-foreground">
            Penalty active: no vault protection for 1 hour
            {me.penalty.endsAt ? <span className="text-muted-foreground"> · lifts in {remaining(me.penalty.endsAt)}</span> : null}
          </div>
        ) : null}
        <div className="p-4 md:p-6 xl:p-8">
          <div className="mb-6 flex items-end justify-between border-b border-border pb-5">
            <div>
              <p className="font-mono text-[9px] uppercase text-primary">Volterisk / {location.pathname === '/' ? 'dashboard' : location.pathname.slice(1)}</p>
              <h1 className="font-display text-4xl font-semibold uppercase md:text-5xl">{meta[0]}</h1>
              {meta[1] ? <p className="mt-1 max-w-xl text-sm text-muted-foreground">{meta[1]}</p> : null}
            </div>
            <p className="hidden font-mono text-[9px] uppercase text-muted-foreground md:block">{stamp}</p>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
