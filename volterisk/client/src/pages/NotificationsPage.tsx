import { useEffect, useState } from 'react'
import { Notice, PageTitle, Panel } from '../components/ui.tsx'
import { ApiError, api, isMissing, load } from '../lib/api.ts'
import { noticeText, when } from '../lib/format.ts'
import type { GameNotice } from '../lib/types.ts'

export function NotificationsPage() {
  const [rows, setRows] = useState<GameNotice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    void api('/api/notifications/read', { method: 'POST', body: '{}' }).catch(() => undefined)
    load<{ notifications: GameNotice[] }>('/api/notifications')
      .then((data) => setRows(data.notifications.map((row) => ({ ...row, read: true }))))
      .catch((err: unknown) => {
        if (isMissing(err)) {
          setMissing(true)
          setRows([])
          return
        }
        setError(err instanceof ApiError ? err.message : 'The wire did not answer.')
      })
  }, [])

  return (
    <div className="max-w-2xl space-y-4">
      <PageTitle kicker="The wire">Notifications</PageTitle>
      {missing ? <Notice tone="muted">The wire is quiet. Nothing is posted.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {rows === null && !error ? <Notice tone="muted">Listening…</Notice> : null}
      {rows && rows.length === 0 && !missing ? <Notice tone="muted">No messages on the wire.</Notice> : null}
      <div className="space-y-3">
        {rows?.map((row) => (
          <Panel key={row.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className={`text-[11px] font-semibold tracking-[0.18em] uppercase ${tone(row.severity)}`}>
                {label(row.severity)}
              </p>
              <p className="text-sm text-muted">{when(row.createdAt)}</p>
            </div>
            <h2 className="mt-1 font-serif text-xl">{row.title}</h2>
            <p className="mt-1 text-sm text-muted">{noticeText(row.title, row.body)}</p>
          </Panel>
        ))}
      </div>
    </div>
  )
}

function tone(severity?: string) {
  if (severity === 'CRITICAL') return 'text-danger'
  if (severity === 'WARNING') return 'text-gold'
  return 'text-muted'
}

function label(severity?: string) {
  if (severity === 'CRITICAL') return 'Critical'
  if (severity === 'WARNING') return 'Warning'
  return 'Info'
}
