import type { ReactNode } from 'react'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink p-3 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-5xl overflow-hidden rounded-[28px] border border-line bg-board md:grid-cols-2">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-panel p-10 md:flex">
          <div>
            <p className="font-serif text-4xl tracking-[0.12em]">IRON HOUR</p>
            <p className="mt-3 max-w-sm text-muted">Other people&apos;s vaults, after the street goes quiet.</p>
          </div>
          <svg viewBox="0 0 280 180" className="absolute -right-8 bottom-0 h-56 w-80 text-gold/80" aria-hidden="true">
            <rect x="20" y="70" width="36" height="90" fill="currentColor" opacity="0.12" />
            <rect x="64" y="40" width="28" height="120" fill="currentColor" opacity="0.18" />
            <rect x="100" y="58" width="48" height="102" fill="currentColor" opacity="0.1" />
            <rect x="156" y="28" width="30" height="132" fill="currentColor" opacity="0.2" />
            <rect x="196" y="64" width="52" height="96" fill="currentColor" opacity="0.12" />
            <circle cx="40" cy="40" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="40" cy="40" r="4" fill="currentColor" />
          </svg>
        </section>
        <section className="flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <p className="mb-6 font-serif text-3xl tracking-[0.12em] md:hidden">IRON HOUR</p>
            <h1 className="font-serif text-2xl">{title}</h1>
            {children}
          </div>
        </section>
      </div>
    </div>
  )
}
