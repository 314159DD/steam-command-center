import { db } from './db'
import { buildDigest } from './digest'
import { rankBacklog } from './backlog'
import { fetchFullAchievements } from './achievements'

export type Toggles = { quality: boolean; taste: boolean; my_games: boolean; global: boolean }

export async function getActionDigest(steamId: string) {
  const rows = (await db()`
    select g.app_id, g.name, g.header_image, g.proton_tier, g.sub_names, g.bundle_count, g.bundle_name,
           g.itad_price_cents, g.itad_atl_cents, g.itad_cut,
           uga.achieved, uga.total, ul.kind,
           (select max(u.posted_at) from updates u
              where u.app_id = g.app_id and u.classification in ('MAJOR','HOTFIX')
                and u.posted_at > now() - interval '2 days') as recent_major,
           (select pc.player_count from player_counts pc where pc.app_id = g.app_id order by pc.captured_at desc limit 1) as cur_players,
           (select pc.player_count from player_counts pc where pc.app_id = g.app_id order by pc.captured_at desc offset 1 limit 1) as prev_players
    from user_libraries ul
    join games g on g.app_id = ul.app_id
    left join user_game_achievements uga on uga.steam_id = ul.steam_id and uga.app_id = ul.app_id
    where ul.steam_id = ${steamId}
      and g.app_id not in (select app_id from dismissed_digest where steam_id = ${steamId})`) as any[]
  return buildDigest(rows)
}

export async function dismissDigest(steamId: string, appId: number) {
  await db()`
    insert into dismissed_digest (steam_id, app_id)
    values (${steamId}, ${appId})
    on conflict do nothing`
}

export async function getDiscovery(category: string | string[], limit = 40) {
  const cats = Array.isArray(category) ? category : [category]
  const rows = await db()`
    select g.app_id, g.name, g.header_image, g.tags, g.review_count, g.review_score, g.price_cents, g.proton_tier, g.owners_estimate, g.recent_review_pct, g.review_trend,
           g.opencritic, g.metacritic,
           g.itad_price_cents, g.itad_atl_cents, g.itad_cut, g.itad_shop, s.captured_at
    from app_snapshots s join games g on g.app_id = s.app_id
    where s.category = any(${cats})
    order by s.captured_at desc, s.rank asc
    limit ${limit}` as any[]
  const seen = new Set<number>()
  return rows.filter((r) => r.app_id && !seen.has(r.app_id) && seen.add(r.app_id))
}

export async function getNewReleases(steamId?: string | null) {
  const rows = (await db()`
    select g.app_id, g.name, g.header_image, g.tags, g.review_count, g.review_score,
           g.price_cents, g.released_at, g.owners_estimate, g.recent_review_pct, g.review_trend,
           g.opencritic, g.metacritic, g.igdb_aggregated_rating, g.igdb_rating_count,
           g.igdb_hypes, g.igdb_follows,
           g.itad_price_cents, g.itad_atl_cents, g.itad_cut, g.itad_shop,
           exists(select 1 from app_snapshots s where s.app_id = g.app_id and s.category = 'trending') as popular_new
    from games g
    where g.released_at is not null and g.released_at >= current_date - interval '30 days'`) as any[]
  if (!steamId) return rows.map((r) => ({ ...r, lib: null }))
  const lib = (await db()`select app_id, kind from user_libraries where steam_id = ${steamId}`) as any[]
  const kindByApp = new Map(lib.map((l) => [l.app_id, l.kind]))
  return rows.map((r) => ({ ...r, lib: kindByApp.get(r.app_id) ?? null }))
}

export async function getMostPlayed(limit = 6) {
  return (await db()`select * from most_played_with_momentum(${limit})`) as any[]
}

export async function getUpdatesForUser(steamId: string, limit = 120) {
  const lib = (await db()`select app_id, kind, playtime_forever from user_libraries where steam_id = ${steamId}`) as any[]
  const ids = lib.map((l) => l.app_id)
  if (ids.length === 0) return []
  const flagByApp = new Map(lib.map((l) => [l.app_id, l]))
  const [rows, ach, builds] = await Promise.all([
    db()`
    select u.gid, u.app_id, u.title, u.body, u.url, u.classification, u.posted_at,
           g.name as game_name, g.header_image, g.proton_tier, g.recent_review_pct, g.review_trend,
           g.itad_price_cents, g.itad_atl_cents, g.itad_cut, g.itad_shop
    from updates u join games g on g.app_id = u.app_id
    where u.app_id = any(${ids})
    order by u.posted_at desc
    limit ${limit}` as Promise<any[]>,
    db()`select app_id, achieved, total, pct, rarest_name, rarest_pct from user_game_achievements where steam_id = ${steamId}` as Promise<any[]>,
    db()`
    select distinct on (app_id) app_id, build_id, detected_at
    from build_history
    where app_id = any(${ids})
    order by app_id, detected_at desc` as unknown as Promise<{ app_id: number; build_id: string; detected_at: Date | string }[]>,
  ])
  const achByApp = new Map(ach.map((a) => [a.app_id, a]))
  const buildByApp = new Map(builds.map((b) => [b.app_id, { build_id: b.build_id, detected_at: b.detected_at }]))
  return rows.map((u) => ({
    ...u,
    games: { name: u.game_name },
    lib: flagByApp.get(u.app_id),
    ach: achByApp.get(u.app_id) ?? null,
    latestBuild: buildByApp.get(u.app_id) ?? null,
  }))
}

export async function getPrefs(steamId: string) {
  const rows = (await db()`select toggles, tag_weights from user_prefs where steam_id = ${steamId}`) as any[]
  return rows[0] ?? { toggles: { quality: true, taste: true, my_games: true, global: false }, tag_weights: {} }
}

export async function saveToggles(steamId: string, toggles: Toggles) {
  await db()`
    insert into user_prefs (steam_id, toggles, updated_at)
    values (${steamId}, ${JSON.stringify(toggles)}::jsonb, now())
    on conflict (steam_id) do update set toggles = excluded.toggles, updated_at = now()`
}

export async function getPriceDrops(steamId: string) {
  const rows = (await db()`
    select distinct on (pd.app_id) pd.app_id, pd.old_cents, pd.new_cents, pd.at_atl, pd.dropped_at,
           g.name, g.header_image, g.proton_tier
    from price_drops pd
    join user_libraries ul on ul.app_id = pd.app_id and ul.steam_id = ${steamId} and ul.kind = 'wishlist'
    join games g on g.app_id = pd.app_id
    where pd.dropped_at > now() - interval '7 days'
    order by pd.app_id, pd.dropped_at desc`) as any[]
  return rows.sort((a, b) => (a.dropped_at < b.dropped_at ? 1 : -1)).slice(0, 12)
}

export async function getBacklog(steamId: string) {
  const rows = (await db()`
    select g.app_id, g.name, g.header_image, g.proton_tier, g.review_score, g.opencritic, g.metacritic,
           ul.playtime_forever, g.itad_price_cents, g.itad_atl_cents, g.itad_cut, g.itad_shop, g.hltb_main
    from user_libraries ul join games g on g.app_id = ul.app_id
    where ul.steam_id = ${steamId} and ul.kind = 'owned' and ul.playtime_forever < 120
      and g.proton_tier in ('platinum', 'gold')`) as any[]
  return rankBacklog(rows).slice(0, 60)
}

export async function getLibrary(steamId: string) {
  // Whole library (owned + wishlist) for the My Games browser. Sorting/filtering
  // happens client-side, so SQL only needs a stable order.
  return (await db()`
    select g.app_id, g.name, g.header_image, ul.kind, ul.playtime_forever,
           g.proton_tier, g.deck_verified, g.review_score, g.review_count,
           g.recent_review_pct, g.review_trend, g.metacritic, g.opencritic,
           g.itad_price_cents, g.itad_atl_cents, g.itad_cut, g.itad_shop, g.hltb_main,
           uga.pct as ach_pct, uga.achieved as ach_achieved, uga.total as ach_total
    from user_libraries ul
    join games g on g.app_id = ul.app_id
    left join user_game_achievements uga on uga.steam_id = ul.steam_id and uga.app_id = ul.app_id
    where ul.steam_id = ${steamId}
    order by g.name`) as any[]
}

export async function getUpcomingReleases() {
  return (await db()`
    select rc.game_name, rc.release_date, rc.url, rc.steam_app_id, g.header_image
    from release_calendar rc
    left join games g on g.app_id = rc.steam_app_id
    where rc.release_date >= current_date
    order by rc.release_date asc`) as any[]
}

export async function getReleaseCalendar(steamId: string) {
  const rows = (await db()`
    select g.app_id, g.name, g.header_image, g.release_date, g.proton_tier,
           g.itad_price_cents, g.itad_atl_cents, g.itad_cut, g.itad_shop
    from games g
    join user_libraries ul on ul.app_id = g.app_id and ul.steam_id = ${steamId} and ul.kind = 'wishlist'
    where g.coming_soon = true`) as any[]
  // Best-effort chronological sort: parseable dates first, then "Coming soon"/TBA.
  const withTs = rows.map((r) => {
    const t = r.release_date ? Date.parse(r.release_date) : NaN
    return { ...r, _ts: Number.isNaN(t) ? null : t }
  })
  withTs.sort((a, b) => {
    if (a._ts === null && b._ts === null) return a.name.localeCompare(b.name)
    if (a._ts === null) return 1
    if (b._ts === null) return -1
    return a._ts - b._ts
  })
  return withTs
}

export type SearchRow = { app_id: number; name: string; header_image: string | null; review_score: number | null; proton_tier: string | null; review_count?: number | null }

// Pure, testable relevance ordering. The SQL fetches a broad `name ilike '%term%'`
// set; this ranks: exact name match (0) > prefix match (1) > substring (2),
// then by review_count desc as a tiebreak. Returns [] for a blank term.
export function rankSearchResults<T extends { name: string; review_count?: number | null }>(rows: T[], term: string): T[] {
  const t = term.trim().toLowerCase()
  if (!t) return []
  const tier = (name: string) => {
    const n = name.toLowerCase()
    if (n === t) return 0
    if (n.startsWith(t)) return 1
    return 2
  }
  return [...rows].sort((a, b) => {
    const ta = tier(a.name), tb = tier(b.name)
    if (ta !== tb) return ta - tb
    return (b.review_count ?? 0) - (a.review_count ?? 0)
  })
}

// Search OUR games table only (games the collector has seen). A game not yet in
// our DB won't appear - that's correct v1 scope; the detail page reads only from Postgres.
export async function searchGames(term: string, limit = 30): Promise<SearchRow[]> {
  const t = term.trim()
  if (!t) return []
  // The pattern is bound as a parameter (no injection). User `%`/`_` are left as
  // ilike wildcards - harmless for a personal single-user search, mildly useful.
  const rows = (await db()`
    select app_id, name, header_image, review_score, review_count, proton_tier
    from games
    where name ilike ${'%' + t + '%'}`) as SearchRow[]
  return rankSearchResults(rows, t).slice(0, limit)
}

export interface CollectorHealthRow {
  source: string;
  last_status: string;
  last_detail: string | null;
  last_success_at: Date | null;
  updated_at: Date | null;
}

export async function getCollectorHealth(): Promise<CollectorHealthRow[]> {
  const rows = await db()`
    select source, last_status, last_detail, last_success_at, updated_at
    from collector_health
    order by source
  `
  return rows as CollectorHealthRow[]
}

export async function getGameDetail(appId: number, steamId?: string | null) {
  const sql = db()
  const rows = (await sql`
    select g.app_id, g.name, g.header_image, g.tags, g.genres, g.price_cents, g.is_released,
           g.review_score, g.review_count, g.recent_review_pct, g.review_trend,
           g.proton_tier, g.proton_trending_tier, g.proton_confidence, g.deck_verified,
           g.owners_estimate, g.spy_ccu, g.spy_avg_playtime,
           g.itad_price_cents, g.itad_atl_cents, g.itad_cut, g.itad_shop, g.sub_names, g.bundle_count, g.bundle_name,
           g.metacritic, g.metacritic_user, g.opencritic, g.current_build_id,
           g.hltb_main, g.hltb_extra, g.hltb_completionist
    from games g where g.app_id = ${appId}`) as any[]
  const game = rows[0]
  if (!game) return null
  const [news, pc, lib, ach] = await Promise.all([
    sql`select gid, title, body, url, classification, posted_at from updates
        where app_id = ${appId} order by posted_at desc limit 40` as Promise<any[]>,
    sql`select player_count from player_counts where app_id = ${appId} order by captured_at desc limit 1` as Promise<any[]>,
    steamId
      ? (sql`select kind, playtime_forever from user_libraries where steam_id = ${steamId} and app_id = ${appId}` as Promise<any[]>)
      : Promise.resolve([] as any[]),
    steamId
      ? (sql`select achieved, total, pct, rarest_name, rarest_pct from user_game_achievements where steam_id = ${steamId} and app_id = ${appId}` as Promise<any[]>)
      : Promise.resolve([] as any[]),
  ])
  const builds = (await sql`select build_id, detected_at from build_history where app_id = ${appId} order by detected_at desc limit 5`) as any[]
  // Full achievement list (icons) is fetched live for owned games only - best-effort, [] on failure.
  const achList = (steamId && lib[0]?.kind === 'owned') ? await fetchFullAchievements(steamId, appId) : []
  return { game, news, currentPlayers: pc[0]?.player_count ?? null, lib: lib[0] ?? null, ach: ach[0] ?? null, builds, achList }
}

export async function getGameCard(appId: number, steamId?: string | null) {
  const rows = (await db()`
    select g.app_id, g.name, g.header_image, g.developer, g.release_date,
           g.trailer_movie_id, g.screenshots, g.spy_ccu, g.igdb_follows, g.tags, g.spy_tags,
           g.has_vac, g.family_sharing, g.review_score, g.review_count, g.price_cents,
           g.itad_price_cents, g.itad_atl_cents, g.itad_cut,
           g.proton_tier, g.deck_verified, g.recent_review_pct, g.review_trend,
           (select pc.player_count from player_counts pc
            where pc.app_id = g.app_id order by pc.captured_at desc limit 1) as live_players
    from games g where g.app_id = ${appId}`) as any[]
  const g = rows[0]
  if (!g) return null
  let lib: string | null = null
  let playtime_forever: number | null = null
  if (steamId) {
    const l = (await db()`select kind, playtime_forever from user_libraries where steam_id = ${steamId} and app_id = ${appId} limit 1`) as any[]
    lib = l[0]?.kind ?? null
    playtime_forever = l[0]?.playtime_forever ?? null
  }
  return { ...g, lib, playtime_forever }
}
