export type DigestReason = { type: 'atl' | 'ach' | 'patch' | 'sub' | 'spike' | 'bundle'; label: string }
export type DigestItem = {
  app_id: number; name: string; header_image: string | null; proton_tier?: string | null
  kind: string; reasons: DigestReason[]; score: number
}

const euro = (c: number) => `€${(c / 100).toFixed(2)}`

/**
 * Fuse per-game signals into a ranked "worth your attention today" list - the
 * cross-source signal no incumbent composes. Signals are gated by ownership:
 *   - price-at-all-time-low → only for WISHLIST games (you might buy)
 *   - near-100% achievements / a fresh MAJOR-HOTFIX patch → only for OWNED games (you play them)
 * Games with no actionable signal are dropped.
 */
export function buildDigest(rows: any[]): DigestItem[] {
  const items: DigestItem[] = []
  for (const r of rows) {
    const reasons: DigestReason[] = []
    let score = 0
    const owned = r.kind === 'owned'
    const price = r.itad_price_cents
    const atl = r.itad_atl_cents

    if (!owned && price != null && atl != null && price > 0 && price <= atl) {
      reasons.push({ type: 'atl', label: `All-time low ${euro(price)}` })
      score += 80
    }
    const subs: string[] = r.sub_names ?? []
    if (!owned && subs.length > 0) {
      reasons.push({ type: 'sub', label: `On ${subs[0]} - play free` })
      score += 85
    }
    if (!owned && (r.bundle_count ?? 0) > 0) {
      reasons.push({ type: 'bundle', label: `In a bundle (${r.bundle_name ?? 'active'})` })
      score += 75
    }
    if (owned && r.cur_players != null && r.prev_players && r.cur_players >= r.prev_players * 1.5 && r.cur_players >= 1000) {
      reasons.push({ type: 'spike', label: `Players spiking (${r.cur_players.toLocaleString()})` })
      score += 70
    }
    const remaining = (r.total ?? 0) - (r.achieved ?? 0)
    if (owned && r.total > 0 && r.achieved > 0 && remaining >= 1 && remaining <= 3) {
      reasons.push({ type: 'ach', label: `${remaining} achievement${remaining > 1 ? 's' : ''} from 100%` })
      score += 90
    }
    if (owned && r.recent_major) {
      reasons.push({ type: 'patch', label: 'Major patch just dropped' })
      score += 100
    }

    if (reasons.length > 0) {
      items.push({ app_id: r.app_id, name: r.name, header_image: r.header_image ?? null, proton_tier: r.proton_tier ?? null, kind: r.kind, reasons, score })
    }
  }
  items.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return items
}

/**
 * Split a ranked list into the first `n` (shown by default) and the rest
 * (revealed by "show more"). Pure helper so the paging math is testable.
 */
export function splitDigest<T>(items: T[], n: number): { visible: T[]; rest: T[] } {
  return { visible: items.slice(0, n), rest: items.slice(n) }
}

/** Split a list into consecutive pages of size n (last page may be shorter). */
export function chunk<T>(items: T[], n: number): T[][] {
  if (n <= 0) return items.length ? [items] : []
  const out: T[][] = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out
}
