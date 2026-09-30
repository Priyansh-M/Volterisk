import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from '../Icons.tsx'
import { IconButton } from './Button.tsx'
import { Ident, Meta } from './primitives.tsx'

export function Modal({
  open,
  onClose,
  code,
  title,
  children,
  footer,
  width = 'md',
}: {
  open: boolean
  onClose: () => void
  code?: string
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  const max = width === 'sm' ? 'max-w-sm' : width === 'lg' ? 'max-w-3xl' : 'max-w-lg'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="anim-fade absolute inset-0 cursor-default bg-ink/80 backdrop-blur-[1px]"
      />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anim-rise relative w-full ${max} rounded-t-[8px] border border-line-2 bg-panel shadow-[0_40px_90px_-40px_rgba(0,0,0,0.95)] sm:rounded-[6px]`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {code ? <Ident>{code}</Ident> : null}
            <h2 className="mt-1 text-[15px] leading-none font-semibold tracking-[0.12em] text-paper uppercase">
              {title}
            </h2>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <IconClose size={15} />
          </IconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}

export function ConfirmPanel({
  code,
  title,
  lines,
  confirmLabel,
  cancelLabel = 'CANCEL',
  onConfirm,
  onCancel,
  busy = false,
  tone = 'gold',
  children,
}: {
  code?: string
  title: string
  lines?: { label: string; value: ReactNode }[]
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  tone?: 'gold' | 'danger'
  children?: ReactNode
}) {
  const border = tone === 'danger' ? 'border-danger/45' : 'border-gold/45'
  return (
    <div className={`anim-rise rounded-[6px] border bg-panel-2 ${border}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2">
        <Meta tone={tone}>{title}</Meta>
        {code ? <Ident>{code}</Ident> : null}
      </div>
      <div className="px-3.5 py-3">
        {lines && lines.length > 0 ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            {lines.map((line) => (
              <div key={line.label}>
                <dt className="meta text-faint">{line.label}</dt>
                <dd className="mt-1 font-mono text-[12.5px] text-beige">{line.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {children ? <div className={lines && lines.length > 0 ? 'mt-3' : ''}>{children}</div> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`meta cursor-pointer rounded-[4px] border px-3.5 py-2.5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
              tone === 'danger'
                ? 'border-danger/60 bg-danger/20 text-danger hover:bg-danger/30'
                : 'border-gold/60 bg-gold/20 text-gold hover:bg-gold/30'
            }`}
          >
            {busy ? 'WORKING…' : confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="meta cursor-pointer rounded-[4px] border border-line-2 px-3.5 py-2.5 text-muted transition-colors duration-150 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
