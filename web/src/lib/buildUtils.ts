/**
 * Returns true if `detected_at` falls within `days` (default 14) of `now`.
 * Accepts a Date object, an ISO-8601 string (as returned by the Neon HTTP driver),
 * or null/undefined. Returns false for null/undefined/invalid input.
 */
export function isRecentBuild(detected_at: Date | string | null | undefined, now: Date, days = 14): boolean {
  if (detected_at == null) return false
  const d = detected_at instanceof Date ? detected_at : new Date(detected_at)
  if (isNaN(d.getTime())) return false
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return d >= cutoff
}
