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
  const [quote, setQuote] = useState<{ attack: number; defense: number; advantage: number; estimatedChance: number; weaponName: string; weaponLevel: number; vaultTier: string; vaultLevel: number } | null>(null)
  const [predictors, setPredictors] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<HeistResult | null>(null)

  useEffect(() => {
    Promise.all([
      api<TargetBoard>('/api/heists/targets'),
      api<{ owned: OwnedWeapon[] }>('/api/me/weapons'),
      api<{ predictor: { quantity: number } }>('/api/shop'),
    ])
      .then(([targetData, weaponData, shop]) => {
        setBoard(targetData)
        setPredictors(shop.predictor.quantity)
        setWeapons(weaponData.owned)
        const equipped = weaponData.owned.find((weapon) => weapon.equipped) ?? weaponData.owned[0]
        setWeaponId(equipped?.instanceId ?? equipped?.id ?? null)
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load targets.'))
  }, [])

  useEffect(() => {
    if (!targetId || !weaponId) {
      setQuote(null)
      return
    }
    let cancelled = false
    const weapon = weapons.find((row) => (row.instanceId ?? row.id) === weaponId)
    api<NonNullable<typeof quote>>('/api/heists/quote', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId: targetId,
        weaponId: weapon?.id ?? weaponId,
        instanceId: weapon?.instanceId,
        kind,
      }),
    })
      .then((data) => {
        if (!cancelled) setQuote(data)
      })
      .catch(() => {
        if (!cancelled) setQuote(null)
      })
    return () => {
      cancelled = true
    }
  }, [targetId, weaponId, kind, weapons])

  async function usePredictor() {
    if (!targetId || !weaponId) return
    setBusy(true)
    setError(null)
    try {
      const data = await api<{ estimatedChance: number }>('/api/heists/estimate', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: targetId, weaponId, kind }),
      })
      setChance(data.estimatedChance)
      setPredictors((count) => Math.max(0, count - 1))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The predictor did not fire.')
    } finally {
      setBusy(false)
    }
  }

  const targets = board ? (kind === 'npc' ? board.npc : board.players) : null
  const weapon = weapons.find((row) => row.id === weaponId) ?? null
  const cooling = me ? remaining(me.cooldownEndsAt) !== 'Ready' : false

  async function commit() {
    if (!targetId || !weaponId) return
    setBusy(true)
    setError(null)
    try {
      const weapon = weapons.find((row) => (row.instanceId ?? row.id) === weaponId)
      const heist = await api<HeistResult & { broken?: boolean }>('/api/heists', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: targetId,
          weaponId: weapon?.id ?? weaponId,
          instanceId: weapon?.instanceId,
          kind,
        }),
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
                    setChance(null)
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
                    setChance(null)
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
                        setChance(null)
                        setConfirming(false)
                      }}
                    >
                      {weapons.map((item) => (
                        <option key={item.instanceId ?? item.id} value={item.instanceId ?? item.id}>
                          {item.name} (L.{item.upgradeLevel}) · attack {item.attack ?? item.effectiveLevel}
                          {item.durability != null ? ` · ${item.durability} uses` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {quote ? (
                    <div className="mt-3 grid gap-3 border border-border p-3 sm:grid-cols-2">
                      <div>
                        <p className="font-mono text-[9px] uppercase text-muted-foreground">Your equipment</p>
                        <p className="font-display text-xl uppercase">{quote.weaponName}</p>
                        <p className="text-sm">Level {quote.weaponLevel}</p>
                        <p className="text-sm">Attack power: {quote.attack}</p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] uppercase text-muted-foreground">Target vault</p>
                        <p className="font-display text-xl uppercase">{quote.vaultTier} vault</p>
                        <p className="text-sm">Level {quote.vaultLevel}</p>
                        <p className="text-sm">Defense: {quote.defense}</p>
                      </div>
                      <p className="sm:col-span-2 font-mono text-xs">
                        Attack advantage: {quote.advantage >= 0 ? `+${quote.advantage}` : quote.advantage} · Estimated success {quote.estimatedChance}%
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Btn disabled={busy || predictors < 1 || !weaponId} onClick={() => void usePredictor()}>
                      Use Estimate Predictor
                    </Btn>
                    <span className="font-mono text-[10px] uppercase text-muted">{predictors} in the case</span>
                  </div>
                  {chance !== null ? (
                    <p className="mt-3 text-sm">
                      Server chance: <span className="text-primary">{chance}%</span>
                      {weapon ? ` with ${weapon.name}` : ''}
                    </p>
                  ) : null}
                  {confirming ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="gold" disabled={busy || !row.vulnerable || cooling} onClick={() => void commit()}>
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/75 p-4">
          <section className={`animate-heist w-full max-w-md border bg-card p-8 text-center shadow-2xl ${result.success ? 'border-success' : 'border-destructive'}`}>
            <p className="font-mono text-[10px] uppercase text-muted-foreground">{result.targetUsername}</p>
            <h2 className={`mt-3 font-display text-6xl font-semibold uppercase ${result.success ? 'text-success' : 'text-destructive'}`}>
              {result.success ? 'Success' : 'Failure'}
            </h2>
            <dl className="mt-6 space-y-3 text-left text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="font-mono text-[10px] uppercase text-muted-foreground">Chance</dt>
                <dd>{result.successChance}%</dd>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <dt className="font-mono text-[10px] uppercase text-muted-foreground">Item used</dt>
                <dd>{result.weaponName}</dd>
              </div>
              {result.success ? (
                <div className="flex justify-between">
                  <dt className="font-mono text-[10px] uppercase text-muted-foreground">Money Stolen</dt>
                  <dd className="font-mono text-success">{money(result.amountStolen)}</dd>
                </div>
              ) : null}
            </dl>
            {result.broken ? <p className="mt-4 font-display text-xl uppercase text-destructive">Broken. Removed from the arsenal.</p> : null}
            <button type="button" className="nav-pill mt-6 w-full cursor-pointer px-4 py-2 text-[11px] font-semibold tracking-[0.16em] uppercase" onClick={() => setResult(null)}>
              Close
            </button>
          </section>
        </div>
      ) : null}
    </div>
  )
}
