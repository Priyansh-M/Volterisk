import { Btn } from './ui.tsx'

/** Pre–Reputation 15 warning when buying a modification you cannot install yet. */
export function ModBuyWarning({
  onDismiss,
  onBuyAnyway,
  busy,
}: {
  onDismiss: () => void
  onBuyAnyway: () => void
  busy?: boolean
}) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-background/85 p-4">
      <section className="w-full max-w-md border border-primary bg-card px-5 py-5 shadow-2xl">
        <p className="font-display text-2xl font-semibold uppercase tracking-wide text-destructive">Warning</p>
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          Even if you proceed with this transaction, you will be unable to use modifications until Reputation level
          15.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Btn disabled={busy} onClick={onDismiss}>
            Dismiss
          </Btn>
          <Btn variant="gold" disabled={busy} onClick={onBuyAnyway}>
            {busy ? 'Buying…' : 'Buy anyway'}
          </Btn>
        </div>
      </section>
    </div>
  )
}
