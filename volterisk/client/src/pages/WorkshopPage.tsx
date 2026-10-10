import { useEffect, useState } from 'react'
import { MaterialIcon } from '../components/MaterialIcon.tsx'
import { MaterialsHelp } from '../components/MaterialsHelp.tsx'
import { Btn, Notice, PageTitle } from '../components/ui.tsx'
import { ApiError, api, load } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money } from '../lib/format.ts'

type WorkshopFile = {
  level: number
  maxLevel: number
  slots: number
  activeJobs: number
  timeReduction: number
  upgrade: { toLevel: number; cash: number; common: number; uncommon: number; rare: number; exotic: number } | null
  jobs: {
    id: string
    name: string
    status: string
    progress: number
    remainingMs: number
    completesAt: string
  }[]
  recipes: {
    id: string
    name: string
    description?: string
    tier: string
    cash: number
    workshopLevel: number
    effectiveMs: number
    available: boolean
    lockReason: string | null
    materials: Record<string, number>
    ownedMaterials: Record<string, number>
  }[]
}

const WORKSHOP_MIN_REPUTATION = 5

export function WorkshopPage() {
  const { me, refresh } = useAuth()
  const [workshop, setWorkshop] = useState<WorkshopFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const locked = (me?.level ?? 0) < WORKSHOP_MIN_REPUTATION

  async function reload() {
    const shop = await load<WorkshopFile>('/api/workshop')
    setWorkshop(shop)
  }

  useEffect(() => {
    if (locked) return
    reload().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Workshop did not open.'))
  }, [locked])

  if (locked) {
    return <Notice tone="muted">Minimum reputation level five to access.</Notice>
  }

  if (!workshop && !error) return <Notice tone="muted">Opening the workshop…</Notice>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle kicker="Finances & Assets">Workshop</PageTitle>
        <MaterialsHelp />
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {workshop ? (
        <div className="space-y-4">
          <section className="border border-border bg-card p-4">
            <p className="font-mono text-[9px] uppercase text-primary">Workshop level {workshop.level}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Jobs {workshop.activeJobs}/{workshop.slots} · craft time −{Math.round(workshop.timeReduction * 100)}%
            </p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Craft weapon and vault modifications from materials. New recipes unlock as you raise the workshop level —
              once unlocked they stay on this account forever through every later upgrade.
            </p>
            {workshop.level === 6 ? (
              <Notice tone="ok">
                Level 6 adds no new recipes. This upgrade improves craft capacity and speed: you can run up to{' '}
                {workshop.slots} jobs at once, and craft times are cut by {Math.round(workshop.timeReduction * 100)}%
                (further upgrades raise both further).
              </Notice>
            ) : null}
            {workshop.level >= 10 ? (
              <Notice tone="ok">
                Workshop max: Sector Pigment Kit paints an expanded sector any of 15 custom colours (not legend
                colours). Overbuilt Frame adds +20 weapon durability — removing it destroys the mod.
              </Notice>
            ) : null}
            {workshop.upgrade ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-foreground">
                  <strong>Next:</strong> level {workshop.upgrade.toLevel} ·{' '}
                  <strong>{money(workshop.upgrade.cash)}</strong>
                  {[
                    workshop.upgrade.common > 0 ? `${workshop.upgrade.common} common materials` : null,
                    workshop.upgrade.uncommon > 0 ? `${workshop.upgrade.uncommon} uncommon materials` : null,
                    workshop.upgrade.rare > 0 ? `${workshop.upgrade.rare} rare materials` : null,
                    workshop.upgrade.exotic > 0 ? `${workshop.upgrade.exotic} exotic materials` : null,
                  ]
                    .filter(Boolean)
                    .map((part) => ` · ${part}`)
                    .join('')}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Any materials of that rarity count toward the total
                </p>
                <Btn
                  variant="gold"
                  disabled={busy !== null}
                  onClick={() => {
                    setBusy('upgrade')
                    api('/api/workshop/upgrade', { method: 'POST', body: '{}' })
                      .then(() => reload())
                      .then(() => refresh())
                      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Upgrade failed.'))
                      .finally(() => setBusy(null))
                  }}
                >
                  {busy === 'upgrade' ? 'Upgrading…' : `Upgrade to L${workshop.upgrade.toLevel}`}
                </Btn>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Maximum workshop level.</p>
            )}
          </section>

          {workshop.jobs.length > 0 ? (
            <section className="space-y-2">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Active jobs</p>
              {workshop.jobs.map((job) => (
                <div key={job.id} className="border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{job.name}</span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">{job.status}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-background">
                    <div className="h-full bg-primary" style={{ width: `${Math.round(job.progress * 100)}%` }} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    {job.status === 'ready' ? (
                      <Btn
                        disabled={busy !== null}
                        onClick={() => {
                          setBusy(job.id)
                          api('/api/workshop/craft/collect', { method: 'POST', body: JSON.stringify({ jobId: job.id }) })
                            .then(() => reload())
                            .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Collect failed.'))
                            .finally(() => setBusy(null))
                        }}
                      >
                        Collect
                      </Btn>
                    ) : job.status === 'crafting' ? (
                      <Btn
                        disabled={busy !== null}
                        onClick={() => {
                          setBusy(job.id)
                          api('/api/workshop/craft/cancel', { method: 'POST', body: JSON.stringify({ jobId: job.id }) })
                            .then(() => reload())
                            .then(() => refresh())
                            .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Cancel failed.'))
                            .finally(() => setBusy(null))
                        }}
                      >
                        Cancel
                      </Btn>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-2">
            {workshop.recipes.length === 0 ? (
              <Notice tone="muted">No recipes unlocked yet. Upgrade the workshop to reveal crafts.</Notice>
            ) : null}
            {workshop.recipes.map((r) => (
              <article key={r.id} className="border border-border bg-card p-4">
                <p className="font-mono text-[9px] uppercase text-muted-foreground">
                  {r.tier} · WS L{r.workshopLevel}
                </p>
                <h3 className="font-display text-lg font-semibold uppercase">{r.name}</h3>
                {r.description ? (
                  <p className="mt-1 text-sm leading-snug text-foreground/90">{r.description}</p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">
                  Fee {money(r.cash)} · ~
                  {r.effectiveMs >= 3_600_000
                    ? `${Math.round(r.effectiveMs / 3_600_000)}h`
                    : `${Math.max(1, Math.round(r.effectiveMs / 60_000))}m`}
                </p>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  {Object.entries(r.materials).map(([id, n]) => (
                    <li key={id} className="flex items-center gap-2 font-mono text-xs font-bold">
                      <MaterialIcon id={id} className="h-5 w-5 shrink-0" />
                      <span>
                        {id.replace('mat:', '')} ×{n}{' '}
                        <span className={(r.ownedMaterials[id] ?? 0) >= n ? 'text-success' : 'text-destructive'}>
                          ({r.ownedMaterials[id] ?? 0})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {r.lockReason ? <p className="mt-2 text-xs text-destructive">{r.lockReason}</p> : null}
                <Btn
                  className="mt-3"
                  variant="gold"
                  disabled={!r.available || busy !== null}
                  onClick={() => {
                    setBusy(r.id)
                    api('/api/workshop/craft/start', { method: 'POST', body: JSON.stringify({ recipeId: r.id }) })
                      .then(() => reload())
                      .then(() => refresh())
                      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Craft failed.'))
                      .finally(() => setBusy(null))
                  }}
                >
                  {busy === r.id ? 'Starting…' : 'Craft'}
                </Btn>
              </article>
            ))}
          </section>
        </div>
      ) : null}
    </div>
  )
}
