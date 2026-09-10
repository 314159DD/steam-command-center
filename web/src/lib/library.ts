// Pure, testable sort/filter logic for the My Games library browser.
// The page/component are thin UI shells around these functions.

export type LibraryKind = 'owned' | 'wishlist'

export type LibraryRow = {
  app_id: number
  name: string
  kind: LibraryKind
  header_image?: string | null
  playtime_forever?: number | null // minutes
  proton_tier?: string | null
  deck_verified?: string | null
  review_score?: number | null
  review_count?: number | null
  recent_review_pct?: number | null
  review_trend?: string | null
  metacritic?: number | null
  opencritic?: number | null
  itad_price_cents?: number | null
  itad_atl_cents?: number | null
  itad_cut?: number | null
  itad_shop?: string | null
  hltb_main?: number | null
  ach_pct?: number | null
  ach_achieved?: number | null
  ach_total?: number | null
}

export type SortKey = 'name' | 'hours' | 'completion' | 'deck' | 'review' | 'price'

// Steam Deck / Proton tier ordering: best first. Anything unknown
// (pending / unrated / null) ranks last.
const DECK_RANK: Record<string, number> = {
  platinum: 0,
  gold: 1,
  silver: 2,
  bronze: 3,
  borked: 4,
}
const DECK_LAST = 99
export function deckRank(tier?: string | null): number {
  if (!tier) return DECK_LAST
  const r = DECK_RANK[tier.toLowerCase()]
  return r === undefined ? DECK_LAST : r
}

export function filterByKind(rows: LibraryRow[], kind: 'all' | 'owned' | 'wishlist'): LibraryRow[] {
  if (kind === 'all') return [...rows]
  return rows.filter((r) => r.kind === kind)
}

// Comparator helper: pushes null/undefined to the bottom regardless of direction,
// then compares present values with `cmp`. Returns 0 when both are missing so the
// stable sort preserves input order.
function nullsLast<T>(a: T | null | undefined, b: T | null | undefined, cmp: (x: T, y: T) => number): number {
  const am = a == null
  const bm = b == null
  if (am && bm) return 0
  if (am) return 1
  if (bm) return -1
  return cmp(a as T, b as T)
}

// Pure, stable, non-mutating. Array.prototype.sort is stable (ES2019+), so equal
// keys keep their input order.
export function sortLibrary(rows: LibraryRow[], sortKey: SortKey): LibraryRow[] {
  const out = [...rows]
  switch (sortKey) {
    case 'name':
      out.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'hours':
      out.sort((a, b) => nullsLast(a.playtime_forever, b.playtime_forever, (x, y) => y - x))
      break
    case 'completion':
      out.sort((a, b) => nullsLast(a.ach_pct, b.ach_pct, (x, y) => y - x))
      break
    case 'deck':
      out.sort((a, b) => deckRank(a.proton_tier) - deckRank(b.proton_tier))
      break
    case 'review':
      out.sort((a, b) => nullsLast(a.review_score, b.review_score, (x, y) => y - x))
      break
    case 'price':
      out.sort((a, b) => nullsLast(a.itad_price_cents, b.itad_price_cents, (x, y) => x - y))
      break
  }
  return out
}
