import type { ReactNode } from 'react'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="classified-grid flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-md border border-line bg-ink/85 p-8">
        <p className="font-serif text-2xl tracking-[0.28em]">VOLTERISK</p>
        <p className="mt-1 text-[10px] tracking-[0.22em] text-muted">PRIVATE NETWORK</p>
        <h1 className="mt-8 font-serif text-2xl tracking-[0.08em]">{title}</h1>
        {children}
      </section>
    </div>
  )
}
