import { PageTitle, Panel } from '../components/ui.tsx'
import { useAuth } from '../lib/auth.tsx'
import { heatFromJobs, money, remaining } from '../lib/format.ts'

export function ProfilePage() {
  const { me } = useAuth()
  if (!me) return null
  const heat = heatFromJobs(me.stats.successfulHeists, me.stats.failedHeists)

  return (
    <div className="max-w-xl space-y-4">
      <PageTitle kicker="The name on the book">Profile</PageTitle>
      <Panel>
        <p className="font-serif text-3xl">{me.username}</p>
        <p className="mt-1 text-sm text-muted">
          {me.title} · Level {me.level}
        </p>
        <dl className="mt-5 space-y-3 text-sm">
          <Row label="Rank" value={`#${me.rank}`} />
          <Row label="Base" value={me.base ? `${me.base.regionName} · ${me.base.sectorId.toUpperCase()}` : 'Unfiled'} />
          <Row label="Cash" value={money(me.cash)} gold />
          <Row label="Vault" value={`${money(me.vault.balance)} · lv ${me.vault.level}`} gold />
          <Row
            label="Equipped"
            value={me.equippedWeapon ? `${me.equippedWeapon.name} · up ${me.equippedWeapon.upgradeLevel}` : 'None'}
          />
          <Row label="Jobs run" value={`${heat} (display heat)`} />
          <Row label="Taken" value={`${me.stats.successfulHeists} hits · ${money(me.stats.totalStolen)} stolen`} />
          <Row label="Missed" value={`${me.stats.failedHeists} misses`} />
          <Row label="Lost from vault" value={money(me.stats.totalLost)} />
          <Row label="Cooldown" value={remaining(me.cooldownEndsAt)} />
        </dl>
      </Panel>
    </div>
  )
}

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={gold ? 'text-gold' : ''}>{value}</dd>
    </div>
  )
}
