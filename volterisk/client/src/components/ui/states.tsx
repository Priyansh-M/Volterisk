import type { ReactNode } from 'react'
import { IconAlert, IconFolder, IconRefresh } from '../Icons.tsx'
import { Button } from './Button.tsx'
import { Meta } from './primitives.tsx'

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton block rounded-[3px] ${className}`} aria-hidden="true" />
}

export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={`h-3 ${index % 3 === 2 ? 'w-2/5' : index % 2 === 0 ? 'w-full' : 'w-4/5'}`} />
      ))}
    </div>
  )
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-[6px] border border-line bg-panel p-3.5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-4 h-2.5 w-full" />
          <Skeleton className="mt-2 h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function LoadingState({ label = 'RETRIEVING INTELLIGENCE…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="rounded-[6px] border border-line bg-panel p-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-intel anim-blip" aria-hidden="true" />
        <Meta tone="intel">{label}</Meta>
      </div>
      <div className="mt-3.5">
        <SkeletonLines rows={rows} />
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  compact = false,
}: {
  title: string
  body?: string
  action?: ReactNode
  icon?: ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={`hatched flex flex-col items-center justify-center rounded-[6px] border border-dashed border-line-2 text-center ${
        compact ? 'px-4 py-6' : 'px-5 py-10'
      }`}
    >
      <span className="text-faint">{icon ?? <IconFolder size={22} />}</span>
      <p className="meta mt-3 text-beige">{title}</p>
      {body ? <p className="mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'OPERATION BLOCKED',
  body,
  onRetry,
  retryLabel = 'RETRY',
  action,
}: {
  title?: string
  body?: string
  onRetry?: () => void
  retryLabel?: string
  action?: ReactNode
}) {
  return (
    <div className="anim-rise rounded-[6px] border border-danger/45 bg-danger/[0.08] px-4 py-4" role="alert">
      <div className="flex items-center gap-2 text-danger">
        <IconAlert size={16} />
        <Meta tone="danger">{title}</Meta>
      </div>
      {body ? <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-beige">{body}</p> : null}
      {onRetry || action ? (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {onRetry ? (
            <Button size="sm" variant="outline" icon={<IconRefresh size={14} />} onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  )
}

/** Shown when an endpoint is not deployed yet. In-world, never a stack trace. */
export function OfflineState({
  channel,
  body = 'This intelligence channel is not reporting. The rest of the operation is unaffected.',
  onRetry,
}: {
  channel: string
  body?: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-[6px] border border-line-2 bg-panel px-4 py-5">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden="true" />
        <Meta>{channel} — CHANNEL OFFLINE</Meta>
      </div>
      <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-muted">{body}</p>
      {onRetry ? (
        <div className="mt-3.5">
          <Button size="sm" variant="outline" icon={<IconRefresh size={14} />} onClick={onRetry}>
            RECONNECT
          </Button>
        </div>
      ) : null}
    </div>
  )
}
