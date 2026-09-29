import type { ReactNode } from 'react'
import { money } from '../../lib/format.ts'

export type Tone = 'neutral' | 'gold' | 'danger' | 'success' | 'intel'

const toneText: Record<Tone, string> = {
  neutral: 'text-beige',
  gold: 'text-gold',
  danger: 'text-danger',
  success: 'text-success',
  intel: 'text-intel',
}

const toneBorder: Record<Tone, string> = {
  neutral: 'border-line-2',
  gold: 'border-gold/45',
  danger: 'border-danger/50',
  success: 'border-success/45',
  intel: 'border-intel/45',
}

const toneWash: Record<Tone, string> = {
  neutral: 'bg-paper/[0.035]',
  gold: 'bg-gold/[0.09]',
  danger: 'bg-danger/[0.11]',
  success: 'bg-success/[0.11]',
  intel: 'bg-intel/[0.1]',
}

/** Small uppercase metadata label. The workhorse of the whole interface. */
export function Meta({
  children,
  className = '',
  tone = 'muted',
}: {
  children: ReactNode
  className?: string
  tone?: 'muted' | 'faint' | 'paper' | 'gold' | 'danger' | 'success' | 'intel'
}) {
  const color =
    tone === 'faint'
      ? 'text-faint'
      : tone === 'paper'
        ? 'text-paper'
        : tone === 'gold'
          ? 'text-gold'
          : tone === 'danger'
            ? 'text-danger'
            : tone === 'success'
              ? 'text-success'
              : tone === 'intel'
                ? 'text-intel'
                : 'text-muted'
  return <span className={`meta ${color} ${className}`}>{children}</span>
}

/** Monospace identifier: SECTOR 1847, WEAPON 0001. */
export function Ident({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] tracking-[0.14em] text-beige ${className}`}>{children}</span>
}

export function PageHead({
  file,
  title,
  lede,
  actions,
}: {
  file: string
  title: string
  lede?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Meta tone="faint">{file}</Meta>
        <h1 className="mt-1.5 text-[22px] leading-none font-semibold tracking-[0.13em] text-paper uppercase sm:text-[26px]">
          {title}
        </h1>
        {lede ? <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">{lede}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Panel({
  children,
  label,
  right,
  className = '',
  bodyClassName = '',
  variant = 'default',
  as: As = 'section',
}: {
  children?: ReactNode
  label?: string
  right?: ReactNode
  className?: string
  bodyClassName?: string
  variant?: 'default' | 'secure' | 'document' | 'flat'
  as?: 'section' | 'article' | 'div' | 'aside'
}) {
  const skin =
    variant === 'secure'
      ? 'border-line-2 bg-ink shadow-[inset_0_1px_0_rgba(236,231,221,0.05),0_18px_40px_-28px_rgba(0,0,0,0.9)]'
      : variant === 'document'
        ? 'border-line bg-panel-2 ruled'
        : variant === 'flat'
          ? 'border-line bg-transparent'
          : 'border-line bg-panel'
  return (
    <As className={`rounded-[6px] border ${skin} ${className}`}>
      {label || right ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
          <Meta>{label}</Meta>
          {right ? <div className="flex items-center gap-2">{right}</div> : null}
        </div>
      ) : null}
      <div className={`p-3.5 sm:p-4 ${bodyClassName}`}>{children}</div>
    </As>
  )
}

/** Document-styled card: classification band, subject line, meta grid, body. */
export function Dossier({
  code,
  subject,
  classification,
  tone = 'neutral',
  meta,
  children,
  footer,
  selected = false,
  className = '',
}: {
  code: string
  subject: ReactNode
  classification?: string
  tone?: Tone
  meta?: { label: string; value: ReactNode }[]
  children?: ReactNode
  footer?: ReactNode
  selected?: boolean
  className?: string
}) {
  return (
    <article
      className={`flex flex-col rounded-[6px] border bg-panel transition-colors duration-150 ${
        selected ? `${toneBorder[tone]} bg-panel-2` : 'border-line hover:border-line-2'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2">
        <Ident>{code}</Ident>
        {classification ? <Meta tone={tone === 'neutral' ? 'faint' : tone}>{classification}</Meta> : null}
      </div>
      <div className="px-3.5 pt-3">
        <h3 className="text-[17px] leading-tight font-semibold tracking-[0.06em] text-paper">{subject}</h3>
      </div>
      {meta && meta.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 px-3.5">
          {meta.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="meta text-faint">{row.label}</dt>
              <dd className="mt-1 truncate font-mono text-[12px] text-beige">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children ? <div className="px-3.5 pt-3">{children}</div> : null}
      <div className="flex-1" />
      {footer ? <div className="mt-3.5 border-t border-line px-3.5 py-3">{footer}</div> : null}
    </article>
  )
}

export function StatBlock({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  large = false,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  icon?: ReactNode
  large?: boolean
}) {
  return (
    <div className="rounded-[6px] border border-line bg-panel px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <Meta tone="faint">{label}</Meta>
        {icon ? <span className="text-faint">{icon}</span> : null}
      </div>
      <p
        className={`tabular mt-2 font-mono leading-none font-medium ${toneText[tone]} ${
          large ? 'text-[26px] sm:text-[30px]' : 'text-[19px]'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-[12px] leading-snug text-muted">{hint}</p> : null}
    </div>
  )
}

/** Money is prominent but never arcade: mono, tabular, restrained gold. */
export function Money({
  amount,
  tone = 'gold',
  size = 'md',
  sign,
}: {
  amount: number
  tone?: Tone
  size?: 'sm' | 'md' | 'lg' | 'xl'
  sign?: '+' | '-'
}) {
  const scale =
    size === 'sm' ? 'text-[12px]' : size === 'lg' ? 'text-[22px]' : size === 'xl' ? 'text-[32px]' : 'text-[15px]'
  return (
    <span className={`tabular font-mono font-medium ${toneText[tone]} ${scale}`}>
      {sign ?? ''}
      {money(amount)}
    </span>
  )
}

export function Tag({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={`meta inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-1 ${toneBorder[tone]} ${toneWash[tone]} ${toneText[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Dot({ tone = 'neutral', pulse = false }: { tone?: Tone; pulse?: boolean }) {
  const bg =
    tone === 'gold'
      ? 'bg-gold'
      : tone === 'danger'
        ? 'bg-danger'
        : tone === 'success'
          ? 'bg-success'
          : tone === 'intel'
            ? 'bg-intel'
            : 'bg-muted'
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${bg} ${pulse ? 'anim-blip' : ''}`} aria-hidden="true" />
}

/** Segmented meter. Reads as an instrument, not a game bar. */
export function ProgressMeter({
  value,
  max,
  segments,
  tone = 'gold',
  label,
  readout,
}: {
  value: number
  max: number
  segments?: number
  tone?: Tone
  label?: string
  readout?: ReactNode
}) {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max))
  const count = segments ?? Math.min(Math.max(max, 1), 20)
  const filled = Math.round(ratio * count)
  const fill =
    tone === 'danger'
      ? 'bg-danger'
      : tone === 'success'
        ? 'bg-success'
        : tone === 'intel'
          ? 'bg-intel'
          : tone === 'neutral'
            ? 'bg-beige'
            : 'bg-gold'
  return (
    <div>
      {label || readout ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label ? <Meta tone="faint">{label}</Meta> : <span />}
          {readout ? <span className="tabular font-mono text-[11px] text-beige">{readout}</span> : null}
        </div>
      ) : null}
      <div
        className="flex h-2 gap-[2px]"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        {Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            className={`h-full flex-1 rounded-[1px] transition-colors duration-200 ${
              index < filled ? fill : 'bg-raise'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export function KeyValue({
  rows,
  columns = 1,
}: {
  rows: { label: string; value: ReactNode; tone?: Tone }[]
  columns?: 1 | 2 | 3
}) {
  const grid = columns === 3 ? 'sm:grid-cols-3' : columns === 2 ? 'sm:grid-cols-2' : ''
  return (
    <dl className={`grid gap-x-5 gap-y-3 ${grid}`}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-line/70 pb-2">
          <dt className="meta text-faint">{row.label}</dt>
          <dd className={`tabular truncate font-mono text-[12.5px] ${toneText[row.tone ?? 'neutral']}`}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="my-4 border-line" />
  return (
    <div className="my-4 flex items-center gap-3">
      <Meta tone="faint">{label}</Meta>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function Notice({
  tone = 'neutral',
  title,
  children,
  action,
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      className={`anim-rise flex flex-col gap-2 rounded-[5px] border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${toneBorder[tone]} ${toneWash[tone]}`}
      role={tone === 'danger' ? 'alert' : undefined}
    >
      <div className="min-w-0">
        {title ? <Meta tone={tone === 'neutral' ? 'paper' : tone}>{title}</Meta> : null}
        {children ? <p className="mt-1 text-[12.5px] leading-snug text-beige">{children}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
