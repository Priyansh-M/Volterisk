import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LedgerAlerts } from './LedgerAlerts.tsx'
import { Portrait } from './Portrait.tsx'
import { ReputationAlert } from './ReputationAlert.tsx'
import { api, prefetch } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, remaining } from '../lib/format.ts'
import type { GameNotice } from '../lib/types.ts'
import {
  IconArsenal,
  IconBoard,
  IconHeist,
  IconHome,
  IconMap,
  IconProfile,
  IconProperty,
  IconSeal,
  IconSignal,
  IconVault,
  IconContract,
  IconRank,
} from './Icons.tsx'

const warm: Record<string, string[]> = {
  '/': ['/api/heists/history', '/api/work/contracts', '/api/community'],
  '/heists': ['/api/heists/targets', '/api/me/weapons', '/api/shop'],
  '/assets': ['/api/properties'],
  '/market': ['/api/me/weapons', '/api/shop', '/api/properties'],
  '/arsenal': ['/api/me/weapons', '/api/shop'],
  '/vault': ['/api/me/vault'],
  '/work': ['/api/work/contracts', '/api/work/passive'],
  '/reputation': ['/api/reputation'],
  '/map': ['/api/map/bases'],
  '/leaderboard': ['/api/leaderboard'],
  '/achievements': ['/api/achievements'],
  '/notifications': ['/api/notifications'],
  '/profile': ['/api/me'],
  '/heat': ['/api/me'],
}

const links = [
  { to: '/', label: 'Dashboard', end: true, Icon: IconHome },
  { to: '/heists', label: 'Heists', end: false, Icon: IconHeist },
  { to: '/vault', label: 'Vault', end: false, Icon: IconVault },
  { to: '/arsenal', label: 'Arsenal', end: false, Icon: IconArsenal },
  { to: '/market', label: 'Marketplace', end: false, Icon: IconBoard },
  { to: '/assets', label: 'Assets', end: false, Icon: IconProperty },
  { to: '/work', label: 'Work', end: false, Icon: IconContract },
  { to: '/reputation', label: 'Reputation', end: false, Icon: IconRank },
  { to: '/map', label: 'Map', end: false, Icon: IconMap },
  { to: '/achievements', label: 'Achievements', end: false, Icon: IconSeal },
  { to: '/profile', label: 'Profile', end: false, Icon: IconProfile },
  { to: '/leaderboard', label: 'Leaderboard', end: false, Icon: IconBoard },
]

const pageMeta: Record<string, [string, string]> = {
  '/': ['Operations Center', 'Live overview of your network, assets, and opportunities.'],
  '/heists': ['Heist Intelligence', 'Evaluate targets, exposure, and operational risk.'],
  '/heat': ['Heat', 'Crime raises it. Work and time bring it down.'],
  '/vault': ['Vault Facility', 'Secure capital and improve protection systems.'],
  '/arsenal': ['Classified Arsenal', 'Inspect and manage registered equipment.'],
  '/market': ['Marketplace', 'Tools, property, and automobiles.'],
  '/assets': ['Assets', 'Properties and vehicles you already hold.'],
  '/properties': ['Assets', 'Properties and vehicles you already hold.'],
  '/work': ['Contract Board', 'Select underground work by reward, risk, and location.'],
  '/reputation': ['Reputation', ''],
  '/map': ['World Intelligence', 'Monitor territories and inspect the network.'],
  '/achievements': ['Criminal Record', 'Archived milestones, sealed cases, and distinctions.'],
  '/profile': ['Identity Dossier', 'Your public record, reputation, and operating history.'],
  '/leaderboard': ['Intelligence Ranking', 'Current standing across the criminal network.'],
  '/notifications': ['Incoming Reports', 'Security alerts and operational updates.'],
}

export function Shell() {
  const { me, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notices, setNotices] = useState(0)
  const [unclaimed, setUnclaimed] = useState(me?.unclaimedAchievements ?? 0)
  const [brief, setBrief] = useState(false)

  useEffect(() => {
    if (typeof me?.unclaimedAchievements === 'number') setUnclaimed(me.unclaimedAchievements)
  }, [me?.unclaimedAchievements])

  useEffect(() => {
    if (location.pathname === '/' && sessionStorage.getItem('volterisk-brief') === '1') setBrief(true)
  }, [location.pathname])

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
      <LedgerAlerts onChange={recount} onUnclaimed={setUnclaimed} />
      {brief && location.pathname === '/' ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80 p-4">
          <section className="animate-dossier w-full max-w-lg border border-primary bg-card p-6 shadow-2xl">
            <p className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">Before you step onto the chart</p>
            <h2 className="mt-2 font-display text-3xl font-semibold uppercase">Keep the cash in the vault</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              $25,000 is already in your vault. Heat is the number at the top left of the bar. Heists push it up. Work and time bring it down.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              At 12:00 GMT, if Heat is still above 50, there is a 95% chance the police take every dollar still in your pocket. Money sitting in the vault is not part of that seizure.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The vault can still be robbed, but it has a door, a capacity, and insurance. Loose cash has none of those. Deposit before you go looking for trouble.
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
      <ReputationAlert />
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
                  {me.title} · Lvl {String(me.level).padStart(2, '0')}
                </p>
              </div>
            )}
          </div>
          {collapsed ? null : (
            <div className="mt-4 flex justify-between border-t border-sidebar-border pt-3">
              <span>
                <small className="block font-mono text-[8px] uppercase text-muted-foreground">Cash</small>
                <b className="font-mono text-xs">{money(me.cash)}</b>
              </span>
              <span className="text-right">
                <small className="block font-mono text-[8px] uppercase text-muted-foreground">Location</small>
                <b className="font-mono text-xs">{me.base ? me.base.name?.trim() || 'Unnamed' : 'Unplaced'}</b>
              </span>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              title={collapsed ? link.label : undefined}
              onMouseEnter={() => warm[link.to]?.forEach(prefetch)}
              onFocus={() => warm[link.to]?.forEach(prefetch)}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `mb-0.5 flex h-9 w-full items-center gap-3 border-l-2 px-3 text-left text-xs no-underline ${
                  isActive
                    ? 'border-primary bg-accent text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              }
            >
              <link.Icon className="h-4 w-4 shrink-0" />
              {collapsed ? null : <span>{link.label}</span>}
              {!collapsed && link.to === '/achievements' && unclaimed > 0 ? (
                <span className="ml-auto text-primary" title="Reward ready to claim" aria-label="Reward ready to claim">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                    <path d="M7 4h10v2a5 5 0 0 1-4 4.9V14h3v2H8v-2h3v-3.1A5 5 0 0 1 7 6V4zm-3 1h2v2a3 3 0 0 0 1.2 2.4A4 4 0 0 1 4 6V5zm16 0v1a4 4 0 0 1-3.2 3.4A3 3 0 0 0 18 7V5h2zM9 18h6v2H9v-2z" />
                  </svg>
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <button type="button" className="px-3 font-mono text-[9px] uppercase text-muted-foreground hover:text-foreground" onClick={() => void logout()}>
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
              <span className="block font-mono text-[8px] uppercase text-muted-foreground">Total balance</span>
              <b className="font-mono text-xs">{money(me.cash + me.vault.balance)}</b>
            </div>
            <NavLink to="/notifications" aria-label="Notifications" className="relative text-foreground no-underline">
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
