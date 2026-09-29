import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { heatFromJobs, money } from '../lib/format.ts'
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
} from './Icons.tsx'

const links = [
  { to: '/', label: 'Dashboard', end: true, Icon: IconHome },
  { to: '/map', label: 'Map', end: false, Icon: IconMap },
  { to: '/heists', label: 'Heists', end: false, Icon: IconHeist },
  { to: '/vault', label: 'Vault', end: false, Icon: IconVault },
  { to: '/arsenal', label: 'Arsenal', end: false, Icon: IconArsenal },
  { to: '/properties', label: 'Properties', end: false, Icon: IconProperty },
  { to: '/work', label: 'Work', end: false, Icon: IconContract },
  { to: '/achievements', label: 'Achievements', end: false, Icon: IconSeal },
  { to: '/profile', label: 'Profile', end: false, Icon: IconProfile },
  { to: '/leaderboard', label: 'Leaderboard', end: false, Icon: IconBoard },
]

export function Shell() {
  const { me, logout } = useAuth()
  const [notices, setNotices] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<{ notifications: GameNotice[] }>('/api/notifications')
      .then((data) => {
        if (!cancelled) setNotices(data.notifications.filter((row) => row.read !== true).length)
      })
      .catch(() => {
        if (!cancelled) setNotices(0)
      })
    return () => {
      cancelled = true
    }
  }, [me?.id])

  if (!me) return null
  const heat = heatFromJobs(me.stats.successfulHeists, me.stats.failedHeists)
  const initial = me.username.slice(0, 1).toUpperCase()

  return (
    <div className="flex min-h-screen bg-ink text-paper">
      <aside className="hidden w-[212px] shrink-0 flex-col border-r border-line bg-ink md:flex">
        <div className="px-4 pt-5 pb-4">
          <p className="font-serif text-[15px] tracking-[0.28em]">BLACKLEDGER</p>
          <p className="mt-1 text-[10px] tracking-[0.22em] text-muted">PRIVATE NETWORK</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 border-l-2 px-3 py-2 text-[13px] no-underline ${
                  isActive ? 'border-gold text-gold' : 'border-transparent text-paper/80 hover:text-paper'
                }`
              }
            >
              <link.Icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-line p-3">
          <div className="flex gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-gold/50 font-serif text-gold">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm">{me.username}</p>
              <p className="truncate text-[11px] text-muted">{me.title}</p>
            </div>
          </div>
          <dl className="mt-3 space-y-1 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Level</dt>
              <dd>{me.level}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Cash</dt>
              <dd className="text-gold">{money(me.cash)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Location</dt>
              <dd className="truncate text-right">{me.base ? me.base.regionName : '—'}</dd>
            </div>
          </dl>
          <button type="button" className="mt-3 cursor-pointer text-[11px] tracking-[0.14em] text-muted uppercase hover:text-paper" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 border-b border-line px-3 md:px-5">
          <p className="font-serif text-sm tracking-[0.22em] md:hidden">BLACKLEDGER</p>
          <p className="hidden text-[10px] tracking-[0.2em] text-muted uppercase sm:block">Network online</p>
          <div className="ml-auto flex items-center gap-4 text-[12px]">
            <span className="text-muted" title="Jobs you have run. There is no separate heat system.">
              Heat <span className="ml-1 text-paper tabular-nums">{heat}</span>
            </span>
            <span className="text-muted">
              Vault <span className="ml-1 text-gold tabular-nums">{money(me.vault.balance)}</span>
            </span>
            <NavLink to="/notifications" className="relative text-paper no-underline" aria-label="Notifications">
              <IconSignal className="h-4 w-4" />
              {notices > 0 ? (
                <span className="absolute -top-2 -right-2 min-w-4 bg-gold px-1 text-center text-[10px] text-ink">{notices}</span>
              ) : null}
            </NavLink>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-line px-2 py-2 md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `shrink-0 px-2.5 py-1 text-[12px] no-underline ${isActive ? 'text-gold' : 'text-muted'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
