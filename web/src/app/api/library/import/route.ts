import { NextResponse } from 'next/server'
import { getSteamId } from '@/lib/session'
import { fetchOwnedGames, fetchWishlist, fetchGameInfo } from '@/lib/steam-web-api'
import { db } from '@/lib/db'
import { deriveTagWeights } from '@/lib/taste'
import { fetchAppNews } from '@/lib/news'
import { fetchAchievementSummary } from '@/lib/achievements'

// Library import + an on-demand news crawl can take a while for large libraries.
export const maxDuration = 60

// How many owned games to crawl news for right after import (ranked by recent
// playtime). The rest are covered by the collector cron over time.
const CRAWL_LIMIT = 60

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export async function POST() {
  const steamId = await getSteamId()
  if (!steamId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const [owned, wishlist] = await Promise.all([fetchOwnedGames(steamId), fetchWishlist(steamId)])
  if (owned.length === 0) {
    return NextResponse.json({ error: 'profile_private', owned: 0 }, { status: 409 })
  }
  const rows = [...owned, ...wishlist]
  const sql = db()

  // Wishlist entries arrive as bare app ids, and brand-new games' header images
  // live at a hashed URL we can't derive. Batch-resolve name + header image for
  // every library game so they never render blank, and upsert all of them so the
  // updates FK and the feed join resolve.
  const info = await fetchGameInfo([...new Set(rows.map((r) => r.app_id))])
  const nameFor = (r: typeof rows[number]) => r.name || info.get(r.app_id)?.name || ''
  const imgFor = (r: typeof rows[number]) => info.get(r.app_id)?.header_image ?? null
  await sql.query(
    `insert into games (app_id, name, header_image)
     select * from unnest($1::bigint[], $2::text[], $3::text[])
     on conflict (app_id) do update set
       name = coalesce(nullif(excluded.name, ''), games.name),
       header_image = coalesce(nullif(excluded.header_image, ''), games.header_image)`,
    [rows.map((r) => r.app_id), rows.map(nameFor), rows.map(imgFor)],
  )

  // Replace the user's library atomically: a crash between the delete and the
  // re-insert would otherwise leave them with an empty library. The neon HTTP
  // driver runs sql.transaction([...]) as a single non-interactive transaction;
  // its array accepts both tagged-template and sql.query() query objects.
  await sql.transaction([
    sql`delete from user_libraries where steam_id = ${steamId}`,
    sql.query(
      `insert into user_libraries (steam_id, app_id, kind, playtime_forever, playtime_2weeks)
       select * from unnest($1::text[], $2::bigint[], $3::text[], $4::int[], $5::int[])`,
      [rows.map((r) => r.steam_id), rows.map((r) => r.app_id), rows.map((r) => r.kind),
       rows.map((r) => r.playtime_forever), rows.map((r) => r.playtime_2weeks)],
    ),
  ])

  // On-demand news crawl for the most-relevant owned games so the feed is live now.
  const targets = owned
    .slice()
    .sort((a, b) => (b.playtime_2weeks - a.playtime_2weeks) || (b.playtime_forever - a.playtime_forever))
    .slice(0, CRAWL_LIMIT)
  const crawled = await mapLimit(targets, 10, (t) => fetchAppNews(t.app_id, 5))
  const byGid = new Map(crawled.flat().filter((u) => u.posted_at).map((u) => [u.gid, u]))
  const updates = [...byGid.values()]
  if (updates.length > 0) {
    await sql.query(
      `insert into updates (gid, app_id, title, body, url, classification, posted_at)
       select * from unnest($1::text[], $2::bigint[], $3::text[], $4::text[], $5::text[], $6::text[], $7::timestamptz[])
       on conflict (gid) do update set title = excluded.title, body = excluded.body,
         url = excluded.url, classification = excluded.classification, posted_at = excluded.posted_at`,
      [updates.map((u) => u.gid), updates.map((u) => u.app_id), updates.map((u) => u.title),
       updates.map((u) => u.body), updates.map((u) => u.url), updates.map((u) => u.classification),
       updates.map((u) => u.posted_at)],
    )
  }

  const appIds = owned.map((r) => r.app_id)
  const games = (await sql`select app_id, tags from games where app_id = any(${appIds})`) as any[]
  const weights = deriveTagWeights(owned, games)
  await sql`
    insert into user_prefs (steam_id, tag_weights) values (${steamId}, ${JSON.stringify(weights)}::jsonb)
    on conflict (steam_id) do update set tag_weights = excluded.tag_weights`

  // Achievement summaries for the most-played owned games (bounded; 2 Steam calls each).
  const achTargets = targets.slice(0, 40)
  const achRows = (await mapLimit(achTargets, 8, async (t) => {
    const sum = await fetchAchievementSummary(steamId, t.app_id)
    return sum ? { app_id: t.app_id, ...sum } : null
  })).filter(Boolean) as any[]
  if (achRows.length > 0) {
    await sql.query(
      `insert into user_game_achievements (steam_id, app_id, achieved, total, pct, last_unlock, rarest_name, rarest_pct, updated_at)
       select *, now() from unnest($1::text[], $2::bigint[], $3::int[], $4::int[], $5::int[], $6::timestamptz[], $7::text[], $8::numeric[])
       on conflict (steam_id, app_id) do update set achieved = excluded.achieved, total = excluded.total,
         pct = excluded.pct, last_unlock = excluded.last_unlock, rarest_name = excluded.rarest_name,
         rarest_pct = excluded.rarest_pct, updated_at = now()`,
      [achRows.map(() => steamId), achRows.map((a) => a.app_id), achRows.map((a) => a.achieved),
       achRows.map((a) => a.total), achRows.map((a) => a.pct),
       achRows.map((a) => (a.last_unlock ? new Date(a.last_unlock * 1000).toISOString() : null)),
       achRows.map((a) => a.rarest_name), achRows.map((a) => a.rarest_pct)],
    )
  }

  return NextResponse.json({
    owned: owned.length,
    wishlist: wishlist.length,
    crawled: targets.length,
    updates: updates.length,
  })
}
