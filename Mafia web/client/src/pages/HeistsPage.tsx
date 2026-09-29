import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.tsx'
import { Btn, Field, Notice, PageTitle, inputClass } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { useAuth } from '../lib/auth.tsx'
import { bandLabel, money, remaining } from '../lib/format.ts'
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
      <PageTitle kicker="Dossiers">Heist intelligence</PageTitle>
      <Tabs
        value={kind}
        onValueChange={(value) => {
          setKind(value as HeistKind)
          setTargetId(null)
          setConfirming(false)
          setResult(null)
        }}
      >
        <TabsList>
          <TabsTrigger value="npc">NPC Heists</TabsTrigger>
          <TabsTrigger value="player">Player Heists</TabsTrigger>
        </TabsList>
      </Tabs>
      {targets === null && !error ? <Notice tone="muted">Reading the board…</Notice> : null}
      {targets && targets.length === 0 ? (
        <Notice tone="muted">
          {kind === 'npc' ? 'No night-crew vault is on the board.' : 'No other player vault is open.'}
        </Notice>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {targets?.map((row) => {
          const open = targetId === row.userId
          return (
            <article key={row.userId} className={`border bg-panel p-4 ${open ? 'border-gold/50' : 'border-line'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-xl tracking-wide">{row.username}</h2>
                  <p className="mt-1 text-[12px] text-muted">
                    {bandLabel(row.wealthBucket)} · vault lv {row.vaultLevel}
                    {row.sectorId ? ` · ${row.regionName ?? 'Velmora'} ${row.sectorId.toUpperCase()}` : ''}
                  </p>
                </div>
                <span className={`text-[11px] tracking-[0.14em] uppercase ${row.vulnerable ? 'text-ok' : 'text-danger'}`}>
                  {row.vulnerable ? 'Open' : 'Protected'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Btn
                  onClick={() => {
                    setTargetId(row.userId)
                    setConfirming(false)
                    setResult(null)
                  }}
                >
                  Inspect
                </Btn>
                <Btn
                  variant="gold"
                  disabled={!row.vulnerable || cooling || busy}
                  onClick={() => {
                    setTargetId(row.userId)
                    setConfirming(true)
                    setResult(null)
                  }}
                >
                  {cooling ? `Cooling ${me ? remaining(me.cooldownEndsAt) : ''}` : 'Prepare heist'}
                </Btn>
              </div>
              {open ? (
                <div className="mt-4 border-t border-line pt-3">
                  <Field label="Weapon">
                    <select
                      className={`${inputClass} max-w-sm`}
                      value={weaponId ?? ''}
                      onChange={(event) => {
                        setWeaponId(event.target.value)
                        setConfirming(false)
                      }}
                    >
                      {weapons.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · up {item.upgradeLevel} · lv {item.effectiveLevel}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="mt-3 text-sm">
                    Server estimate: <span className="text-gold">{chance === null ? '—' : `${chance}%`}</span>
                    {weapon ? ` with ${weapon.name}` : ''}
                  </p>
                  {confirming ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="gold" disabled={busy || chance === null || !row.vulnerable || cooling} onClick={() => void commit()}>
                        {busy ? 'Working…' : 'Confirm job'}
                      </Btn>
                      <button type="button" className="cursor-pointer text-[12px] text-muted" onClick={() => setConfirming(false)}>
                        Back off
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {result ? (
        <section className={`border p-4 ${result.success ? 'border-ok' : 'border-danger'}`}>
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
          </dl>
        </section>
      ) : null}
    </div>
  )
}
