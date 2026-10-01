export function money(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function compactMoney(amount: number) {
  if (amount >= 1_000_000) {
    const value = amount / 1_000_000
    return `$${value >= 10 ? value.toFixed(1) : value.toFixed(2)}M`
  }
  if (amount >= 10_000) {
    return `$${(amount / 1_000).toFixed(amount >= 100_000 ? 0 : 1)}K`
  }
  return money(amount)
}

export function bandLabel(bucket: string) {
  if (bucket === 'fortune') return 'Fortune'
  if (bucket === 'heavy') return 'Heavy'
  if (bucket === 'modest') return 'Modest'
  return '—'
}

export function heatFromJobs(successful: number, failed: number) {
  return successful + failed
}

/** Turn stored heist and invite payloads into a sentence. Plain notices pass through. */
export function noticeText(title: string, body: string): string {
  const oldHeat = body.match(/^Heat is (\d+)\. At 12:00 GMT, if it is still above 50, pocket cash can be taken\. The vault is not part of that\.$/)
  if (oldHeat) {
    return `Heat is ${oldHeat[1]}. A heat check takes half the cash in your pocket. Above 100, it takes all of it. The vault is not part of that.`
  }
  const trimmed = body.trim()
  if (!trimmed.startsWith('{')) return body
  try {
    const parsed = JSON.parse(trimmed) as { by?: string; success?: boolean; amountStolen?: number | null }
    const name = parsed.by?.trim() || 'Someone'
    if (title === 'You were robbed' || parsed.success === true) {
      const taken = typeof parsed.amountStolen === 'number' ? money(parsed.amountStolen) : null
      return taken ? `${name} robbed your vault and took ${taken}.` : `${name} robbed your vault.`
    }
    if (title === 'Heist Attempted' || parsed.success === false) {
      return `${name} tried to rob your vault. The door held. Nothing left.`
    }
    if (title === 'Roulette invite') return `${name} invited you to a roulette table.`
  } catch {
    return body
  }
  return body
}

export function remaining(iso: string | null) {
  if (!iso) return 'Ready'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Ready'
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${Math.max(minutes, 1)}m`
}

export function when(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
