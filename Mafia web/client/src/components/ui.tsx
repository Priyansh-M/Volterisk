import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function PageTitle({ kicker, children }: { kicker?: string; children: ReactNode }) {
  return (
    <header className="mb-5">
      {kicker ? <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">{kicker}</p> : null}
      <h1 className="font-serif text-3xl tracking-[0.14em] text-paper uppercase">{children}</h1>
    </header>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`border border-line bg-panel p-4 md:p-5 ${className}`}>
      {children}
    </section>
  )
}

export function Btn({
  variant = 'ghost',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'gold' | 'ghost' | 'danger' }) {
  const look =
    variant === 'gold'
      ? 'gloss-gold'
      : variant === 'danger'
        ? 'border border-danger/50 bg-danger/90 text-paper'
        : 'nav-pill text-paper'
  return (
    <button
      type={type}
      {...props}
      className={`cursor-pointer rounded-sm px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase disabled:cursor-not-allowed disabled:opacity-40 ${look} ${className}`}
    />
  )
}

export function Notice({ tone, children }: { tone: 'muted' | 'danger' | 'ok'; children: ReactNode }) {
  const color = tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : 'text-muted'
  return <p className={`text-sm ${color}`}>{children}</p>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-muted">
      {label}
      <div className="mt-1 text-paper">{children}</div>
    </label>
  )
}

export const inputClass =
  'w-full rounded-sm border border-line bg-ink px-3 py-2 text-paper outline-none ring-gold/0 transition focus:border-gold/40 focus:ring-2 focus:ring-gold/20'
