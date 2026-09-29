import type { ReactNode } from 'react'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-line bg-panel p-10 md:flex">
        <div>
          <p className="font-serif text-4xl">Iron Hour</p>
          <p className="mt-3 max-w-sm text-muted">Other people's vaults, after the street goes quiet.</p>
        </div>
        <svg viewBox="0 0 120 120" className="h-28 w-28 text-gold" aria-hidden="true">
          <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="60" cy="60" r="8" fill="currentColor" />
          <path d="M60 18 v16 M60 86 v16 M18 60 h16 M86 60 h16" stroke="currentColor" strokeWidth="4" />
        </svg>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <p className="mb-6 font-serif text-3xl md:hidden">Iron Hour</p>
          <h1 className="font-serif text-2xl">{title}</h1>
          {children}
        </div>
      </section>
    </div>
  )
}
