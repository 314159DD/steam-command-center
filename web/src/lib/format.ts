function compact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`
  }
  if (n >= 1_000) {
    const k = n / 1_000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
  }
  return String(n)
}

/** Compact a SteamSpy owners range like "100,000,000 .. 200,000,000" -> "100M–200M". */
export function formatOwners(range?: string | null): string | null {
  if (!range) return null
  const parts = range.split('..').map((p) => Number(p.replace(/[, ]/g, '')))
  if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return null
  const [lo, hi] = parts
  if (lo === 0 && hi === 0) return null
  return `${compact(lo)}–${compact(hi)}`
}
