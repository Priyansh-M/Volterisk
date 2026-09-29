import { useEffect, useState } from 'react'
import { Btn, Field, Notice, PageTitle, Panel, inputClass } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { money, remaining } from '../lib/format.ts'
import type { HeistKind, HeistResult, OwnedWeapon, TargetBoard } from '../lib/types.ts'

export function HeistsPage() {
  const { me, refresh } = useAuth()
  const [kind, setKind] = useState<HeistKind>('npc')
  const [board, setBoard] = useState<TargetBoard | null>(null)
  const [weapons, setWeapons] = useState<OwnedWeapon[]>([])
  const [targetId, setTargetId] = useState<string | null>(null)
  const [weaponId, setWeaponId] = useState<string | null>(null)
  const [chance, setChance] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<HeistResult | null>(null)

  useEffect(() => {
    Promise.all([
      api<TargetBoard>('/api/heists/targets'),
      api<{ owned: OwnedWeapon[] }>('/api/me/weapons'),
    ])
      .then(([targetData, weaponData]) => {
        setBoard(targetData)
        setWeapons(weaponData.owned)
        const equipped = weaponData.owned.find((weapon) => weapon.equipped)
        setWeaponId(equipped?.id ?? weaponData.owned[0]?.id ?? null)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load targets.'))
  }, [])

  useEffect(() => {
    if (!targetId || !weaponId) {
      setChance(null)
      return
    }
    let cancelled = false
    const query = new URLSearchParams({ targetUserId: targetId, weaponId, kind })
    api<{ estimatedChance: number }>(`/api/heists/preview?${query.toString()}`)
      .then((data) => {
        if (!cancelled) setChance(data.estimatedChance)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setChance(null)
          setError(err instanceof ApiError ? err.message : 'No estimate.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [targetId, weaponId, kind])

  const targets = board ? (kind === 'npc' ? board.npc : board.players) : null
  const target = targets?.find((row) => row.userId === targetId) ?? null
  const weapon = weapons.find((row) => row.id === weaponId) ?? null
  const cooling = me ? remaining(me.cooldownEndsAt) !== 'Ready' : false

  async function commit() {
    if (!targetId || !weaponId) return
    setBusy(true)
    setError(null)
    try {
      const heist = await api<HeistResult>('/api/heists', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: targetId, weaponId, kind }),
      })
      setResult(heist)
      setConfirming(false)
      await refresh()
      setBoard(await api<TargetBoard>('/api/heists/targets'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The job failed to start.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle kicker="Job street">Heists</PageTitle>
      <div className="flex flex-wrap gap-2">
        <KindButton
          active={kind === 'npc'}
          onClick={() => {
            setKind('npc')
            setTargetId(null)
            setConfirming(false)
            setResult(null)
          }}
        >
          NPC Heists
        </KindButton>
        <KindButton
          active={kind === 'player'}
          onClick={() => {
            setKind('player')
            setTargetId(null)
            setConfirming(false)
            setResult(null)
          }}
        >
          Player Heists
        </KindButton>
      </div>
      {targets === null && !error ? <Notice tone="muted">Reading the city…</Notice> : null}
      {targets && targets.length === 0 ? (
        <Notice tone="muted">
          {kind === 'npc' ? 'No night-crew vault is thick enough to hit.' : 'No other player vault is open.'}
        </Notice>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {targets?.map((row) => (
          <button
            key={row.userId}
            type="button"
            onClick={() => {
              setTargetId(row.userId)
              setConfirming(false)
              setResult(null)
            }}
            className={`cursor-pointer rounded-2xl border p-4 text-left ${
              targetId === row.userId ? 'border-gold bg-panel' : 'border-line bg-panel'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-serif text-xl">{row.username}</h2>
              <span className={row.vulnerable ? 'text-sm text-ok' : 'text-sm text-danger'}>
                {row.vulnerable ? 'Open' : 'Shut'}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              Vault lv {row.vaultLevel} · {row.wealthBucket}
            </p>
          </button>
        ))}
      </div>

      <Panel>
        <Field label="Weapon">
          <select
            className={`${inputClass} max-w-sm`}
            value={weaponId ?? ''}
            onChange={(event) => {
              setWeaponId(event.target.value)
              setConfirming(false)
            }}
          >
            {weapons.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} · up {row.upgradeLevel} · lv {row.effectiveLevel}
              </option>
            ))}
          </select>
        </Field>
        <p className="mt-3 text-sm">
          Server estimate: <span className="text-gold">{chance === null ? '—' : `${chance}%`}</span>
          {weapon ? ` with ${weapon.name}` : ''}
        </p>
        {error ? <p className="mt-2"><Notice tone="danger">{error}</Notice></p> : null}
        {!confirming ? (
          <Btn
            variant="danger"
            className="mt-4"
            disabled={!target || !target.vulnerable || chance === null || cooling || busy}
            onClick={() => setConfirming(true)}
          >
            {cooling ? `Cooling ${me ? remaining(me.cooldownEndsAt) : ''}` : 'Attempt heist'}
          </Btn>
        ) : (
          <div className="mt-4 rounded-2xl border border-line bg-ink p-3">
            <p className="text-sm">
              Hit {target?.username} with {weapon?.name}. The server puts this at {chance}%.
            </p>
            <div className="mt-3 flex gap-2">
              <Btn variant="gold" disabled={busy} onClick={() => void commit()}>
                {busy ? 'Working…' : 'Confirm job'}
              </Btn>
              <button type="button" className="cursor-pointer text-sm text-muted" onClick={() => setConfirming(false)}>
                Back off
              </button>
            </div>
          </div>
        )}
      </Panel>

      {result ? (
        <section className={`rounded-2xl border p-4 ${result.success ? 'border-ok' : 'border-danger'}`}>
          <h2 className={`font-serif text-2xl ${result.success ? 'text-ok' : 'text-danger'}`}>
            {result.success ? `Took ${money(result.amountStolen)}` : 'The door held'}
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Target</dt>
              <dd>{result.targetUsername}</dd>
            </div>
            <div>
              <dt className="text-muted">Weapon</dt>
              <dd>{result.weaponName}</dd>
            </div>
            <div>
              <dt className="text-muted">Vault level</dt>
              <dd>{result.vaultLevel}</dd>
            </div>
            <div>
              <dt className="text-muted">Chance</dt>
              <dd>{result.successChance}%</dd>
            </div>
            {result.success ? null : (
              <div>
                <dt className="text-muted">Cooldown</dt>
                <dd>{remaining(result.cooldownEndsAt)}</dd>
              </div>
            )}
          </dl>
        </section>
      ) : null}
    </div>
  )
}

function KindButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nav-pill cursor-pointer rounded-full px-4 py-2 text-sm ${active ? 'nav-pill-active' : 'text-paper'}`}
    >
      {children}
    </button>
  )
}
