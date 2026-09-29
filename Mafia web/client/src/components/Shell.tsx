import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { money, remaining } from '../lib/format.ts'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/heists', label: 'Heists', end: false },
  { to: '/vault', label: 'Vault', end: false },
  { to: '/arsenal', label: 'Arsenal', end: false },
  { to: '/leaderboard', label: 'Leaderboard', end: false },
]

export function Shell() {
  const { me, logout } = useAuth()
  if (!me) return null

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden border-r border-line bg-panel md:flex md:flex-col">
        <div className="border-b border-line px-5 py-6">
          <p className="font-serif text-2xl">Iron Hour</p>
          <p className="mt-1 text-xs tracking-wide text-muted">Night ledger</p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-panel-2 text-gold' : 'text-paper hover:bg-panel-2'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <p className="font-serif text-lg md:hidden">Iron Hour</p>
          <p className="hidden text-sm text-muted md:block">{me.username}</p>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-gold">{money(me.cash)}</span>
            <span>Lv {me.level}</span>
            <button type="button" className="cursor-pointer text-muted hover:text-paper" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `shrink-0 rounded-md px-3 py-1 text-sm ${isActive ? 'bg-panel-2 text-gold' : 'text-muted'}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="p-4 md:p-8">
          <p className="mb-4 text-sm text-muted">Cooldown {remaining(me.cooldownEndsAt)}</p>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
