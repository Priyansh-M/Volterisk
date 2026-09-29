import { useId, useState, type ReactNode } from 'react'

/** Hover/focus tooltip. Mono body, hairline border, no animation beyond a fade. */
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={`anim-fade pointer-events-none absolute left-1/2 z-40 w-max max-w-[220px] -translate-x-1/2 rounded-[4px] border border-line-2 bg-ink px-2 py-1.5 text-[11px] leading-snug text-beige shadow-[0_16px_30px_-18px_rgba(0,0,0,0.9)] ${
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}

/** Free-floating tooltip used by the world map, positioned in viewport space. */
export function FloatingTip({
  x,
  y,
  lines,
}: {
  x: number
  y: number
  lines: { text: string; tone?: 'ident' | 'state' | 'hint' }[]
}) {
  return (
    <div
      className="anim-fade pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-[4px] border border-line-2 bg-ink/95 px-2.5 py-2 shadow-[0_18px_34px_-18px_rgba(0,0,0,0.95)]"
      style={{ left: x, top: y }}
    >
      {lines.map((line, index) => (
        <p
          key={index}
          className={`font-mono whitespace-nowrap ${
            line.tone === 'hint'
              ? 'mt-1 text-[10px] tracking-[0.1em] text-muted'
              : line.tone === 'state'
                ? 'mt-0.5 text-[10px] tracking-[0.18em] text-gold uppercase'
                : 'text-[11px] tracking-[0.16em] text-paper uppercase'
          }`}
        >
          {line.text}
        </p>
      ))}
    </div>
  )
}
