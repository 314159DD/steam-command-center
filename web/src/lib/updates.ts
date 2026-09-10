import { stripBbcode } from './news'

/**
 * Build a readable one/two-line blurb from an update body, Steam "What's New"
 * style. Cleans residual bbcode/HTML via stripBbcode, then truncates on a word
 * boundary near `max` chars with an ellipsis. Returns '' for empty input.
 */
export function blurb(body: string | null | undefined, max = 140): string {
  const clean = stripBbcode(body ?? '')
  if (clean.length <= max) return clean
  const slice = clean.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice
  return cut.replace(/[\s.,;:!?-]+$/, '') + '…'
}

export type FeedUpdate = {
  gid: string; classification: 'MAJOR' | 'UPDATE' | 'HOTFIX' | 'CONTENT'
  title: string; body: string; url: string | null; posted_at: string
}
export type Achievement = { achieved: number; total: number; pct: number | null; rarest_name?: string | null; rarest_pct?: number | null }
export type GameUpdateGroup = {
  app_id: number; name: string; header_image: string | null; proton_tier?: string | null
  recent_review_pct?: number | null; review_trend?: string | null; ach?: Achievement | null
  itad_price_cents?: number | null; itad_atl_cents?: number | null; itad_cut?: number | null; itad_shop?: string | null
  lib?: { kind: string; playtime_forever: number }
  latestBuild?: { build_id: string; detected_at: Date | string } | null
  latest: string; updates: FeedUpdate[]
}

/** Collapse a flat list of library news rows into one group per game, newest game first. */
export function groupUpdatesByGame(rows: any[]): GameUpdateGroup[] {
  const byApp = new Map<number, GameUpdateGroup>()
  for (const r of rows) {
    let g = byApp.get(r.app_id)
    if (!g) {
      g = {
        app_id: r.app_id,
        name: r.game_name ?? r.games?.name ?? '',
        header_image: r.header_image ?? null,
        proton_tier: r.proton_tier ?? null,
        recent_review_pct: r.recent_review_pct ?? null,
        review_trend: r.review_trend ?? null,
        ach: r.ach ?? null,
        itad_price_cents: r.itad_price_cents ?? null,
        itad_atl_cents: r.itad_atl_cents ?? null,
        itad_cut: r.itad_cut ?? null,
        itad_shop: r.itad_shop ?? null,
        lib: r.lib,
        latestBuild: r.latestBuild ?? null,
        latest: r.posted_at,
        updates: [],
      }
      byApp.set(r.app_id, g)
    }
    g.updates.push({ gid: r.gid, classification: r.classification, title: r.title, body: r.body, url: r.url, posted_at: r.posted_at })
    if (r.posted_at > g.latest) g.latest = r.posted_at
  }
  const groups = [...byApp.values()]
  for (const g of groups) g.updates.sort((a, b) => (a.posted_at < b.posted_at ? 1 : -1))
  groups.sort((a, b) => (a.latest < b.latest ? 1 : -1))
  return groups
}
