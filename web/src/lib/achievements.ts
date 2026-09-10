const API = 'https://api.steampowered.com'

export type PlayerAchievement = { apiname: string; achieved: number; unlocktime: number; name?: string }
export type AchievementSummary = {
  achieved: number; total: number; pct: number | null
  last_unlock: number | null; rarest_name: string | null; rarest_pct: number | null
}

/** Pure: fold player achievements + global rarity into a per-game summary. null if the game has no achievements. */
export function summarizeAchievements(achs: PlayerAchievement[], globalPct: Map<string, number>): AchievementSummary | null {
  if (achs.length === 0) return null
  const unlocked = achs.filter((a) => a.achieved === 1)
  const achieved = unlocked.length
  const total = achs.length
  let last_unlock: number | null = null
  let rarest_name: string | null = null
  let rarest_pct: number | null = null
  for (const a of unlocked) {
    if (a.unlocktime && (last_unlock === null || a.unlocktime > last_unlock)) last_unlock = a.unlocktime
    const pct = globalPct.get(a.apiname)
    if (pct != null && (rarest_pct === null || pct < rarest_pct)) {
      rarest_pct = pct
      rarest_name = a.name ?? a.apiname
    }
  }
  return { achieved, total, pct: total ? Math.round((achieved / total) * 100) : null, last_unlock, rarest_name, rarest_pct }
}

export type SchemaAchievement = { apiname: string; name: string; icon: string; icongray: string }
export type FullAchievement = { apiname: string; name: string; icon: string; achieved: number; global_pct: number | null }

/** Pure: merge player unlock state + schema (names/icons) + global rarity into a sorted list. */
export function mergeFullAchievements(player: PlayerAchievement[], schema: SchemaAchievement[], global: Map<string, number>): FullAchievement[] {
  if (player.length === 0) return []
  const byApi = new Map(schema.map((s) => [s.apiname, s]))
  return player
    .map((p) => {
      const s = byApi.get(p.apiname)
      return {
        apiname: p.apiname,
        name: s?.name || p.name || p.apiname,
        icon: (p.achieved ? s?.icon : s?.icongray) || '',
        achieved: p.achieved,
        global_pct: global.get(p.apiname) ?? null,
      }
    })
    .sort((a, b) => (b.achieved - a.achieved) || ((a.global_pct ?? 100) - (b.global_pct ?? 100)))
}

export async function fetchSchema(appId: number): Promise<SchemaAchievement[]> {
  try {
    const url = new URL(`${API}/ISteamUserStats/GetSchemaForGame/v2/`)
    url.searchParams.set('key', process.env.STEAM_API_KEY!)
    url.searchParams.set('appid', String(appId))
    url.searchParams.set('l', 'english')
    const res = await fetch(url)
    if (!res.ok) return []
    const list = (await res.json())?.game?.availableGameStats?.achievements ?? []
    return list.map((a: any) => ({ apiname: a.name, name: a.displayName ?? a.name, icon: a.icon, icongray: a.icongray }))
  } catch { return [] }
}

/** Live, best-effort: the full achievement list for one game (owned). [] on any failure. */
export async function fetchFullAchievements(steamId: string, appId: number): Promise<FullAchievement[]> {
  const [player, schema, global] = await Promise.all([
    fetchPlayerAchievements(steamId, appId), fetchSchema(appId), fetchGlobalPct(appId),
  ])
  return mergeFullAchievements(player, schema, global)
}

export async function fetchPlayerAchievements(steamId: string, appId: number): Promise<PlayerAchievement[]> {
  try {
    const url = new URL(`${API}/ISteamUserStats/GetPlayerAchievements/v1/`)
    url.searchParams.set('key', process.env.STEAM_API_KEY!)
    url.searchParams.set('steamid', steamId)
    url.searchParams.set('appid', String(appId))
    url.searchParams.set('l', 'english')
    const res = await fetch(url)
    if (!res.ok) return []
    const ps = (await res.json())?.playerstats
    if (!ps?.success || !Array.isArray(ps.achievements)) return []
    return ps.achievements
  } catch { return [] }
}

export async function fetchGlobalPct(appId: number): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  try {
    const url = new URL(`${API}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/`)
    url.searchParams.set('gameid', String(appId))
    const res = await fetch(url)
    if (!res.ok) return out
    const list = (await res.json())?.achievementpercentages?.achievements ?? []
    for (const a of list) out.set(a.name, Number(a.percent))
  } catch { /* best-effort */ }
  return out
}

/** Fetch + summarize a user's achievements for one game (null if none / private). */
export async function fetchAchievementSummary(steamId: string, appId: number): Promise<AchievementSummary | null> {
  const [achs, gp] = await Promise.all([fetchPlayerAchievements(steamId, appId), fetchGlobalPct(appId)])
  return summarizeAchievements(achs, gp)
}
