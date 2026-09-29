import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { heatFromJobs, money, remaining } from '../lib/format.ts'
import {
  IconArsenal,
  IconBoard,
  IconCity,
  IconCrew,
  IconFlame,
  IconHeist,
  IconHome,
  IconIntel,
  IconItems,
  IconContract,
  IconMap,
  IconMarket,
  IconProfile,
  IconSignal,
  IconVault,
} from './Icons.tsx'

const links = [
  { to: '/', label: 'Dashboard', end: true, Icon: IconHome },
  { to: '/city', label: 'City', end: false, Icon: IconCity },
  { to: '/vault', label: 'Vault', end: false, Icon: IconVault },
  { to: '/arsenal', label: 'Arsenal', end: false, Icon: IconArsenal },
  { to: '/heists', label: 'Heists', end: false, Icon: IconHeist },
  { to: '/market', label: 'Market', end: false, Icon: IconMarket },
  { to: '/profile', label: 'Profile', end: false, Icon: IconProfile },
  { to: '/leaderboard', label: 'Leaderboard', end: false, Icon: IconBoard },
  { to: '/map', label: 'Map', end: false, Icon: IconMap },
  { to: '/work', label: 'Work', end: false, Icon: IconContract },
  { to: '/notifications', label: 'Notifications', end: false, Icon: IconSignal },
]

const soon = [
  { label: 'Crew', Icon: IconCrew },
  { label: 'Intel', Icon: IconIntel },
  { label: 'Items', Icon: IconItems },
]

export function Shell() {
  const { me, logout } = useAuth()
  if (!me) return null
  const heat = heatFromJobs(me.stats.successfulHeists, me.stats.failedHeists)
  const cool = remaining(me.cooldownEndsAt)

  return (
    <div className="min-h-screen bg-ink p-3 md:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1280px] flex-col overflow-hidden rounded-[28px] border border-line bg-board shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:min-h-[calc(100vh-2.5rem)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/30 gloss">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-gold" aria-hidden="true">
                <circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                <path d="M12 4.8v2.2M12 17v2.2M4.8 12h2.2M17 12h2.2" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            <div>
              <p className="font-serif text-lg tracking-[0.18em] md:text-xl">IRON HOUR</p>
              <p className="hidden text-[11px] uppercase tracking-[0.2em] text-muted sm:block">{me.username}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-sm md:gap-5">
            <span className="font-semibold tracking-wide text-gold">{money(me.cash)}</span>
            <span className="inline-flex items-center gap-1.5 text-muted" title="Display only — jobs you have run. Not a heat system.">
              <IconFlame className="h-4 w-4 text-danger" />
              <span className="tabular-nums text-paper">{heat}</span>
              <span className="hidden uppercase tracking-[0.16em] sm:inline">Heat</span>
            </span>
            <span className={`hidden rounded-full px-3 py-1 text-xs md:inline ${cool === 'Ready' ? 'nav-pill text-ok' : 'nav-pill text-muted'}`}>
              {cool === 'Ready' ? 'Ready' : `Cooldown ${cool}`}
            </span>
            <button type="button" className="cursor-pointer text-muted hover:text-paper" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[220px_1fr]">
          <aside className="hidden border-r border-line md:flex md:flex-col">
            <nav className="flex flex-col gap-1.5 p-3">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `nav-pill flex items-center gap-2.5 rounded-full px-3 py-2 text-sm ${isActive ? 'nav-pill-active' : 'text-paper/90 hover:text-paper'}`
                  }
                >
                  <link.Icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto space-y-1.5 border-t border-line p-3">
              {soon.map((item) => (
                <p
                  key={item.label}
                  className="flex items-center justify-between rounded-full px-3 py-2 text-sm text-muted/70"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <item.Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.16em]">Soon</span>
                </p>
              ))}
            </div>
          </aside>

          <div className="flex min-w-0 flex-col">
            <nav className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `nav-pill shrink-0 rounded-full px-3 py-1.5 text-sm ${isActive ? 'nav-pill-active' : 'text-muted'}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <main className="flex-1 p-4 md:p-7">
              <p className="mb-4 text-xs uppercase tracking-[0.18em] text-muted md:hidden">
                {cool === 'Ready' ? 'Ready for a job' : `Cooldown ${cool}`}
              </p>
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
