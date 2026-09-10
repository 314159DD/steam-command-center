const API = 'https://api.steampowered.com'

export type LibraryRow = {
  steam_id: string
  app_id: number
  name: string
  kind: 'owned' | 'wishlist'
  playtime_forever: number
  playtime_2weeks: number
}

export function parseOwnedGames(payload: any, steamId: string): LibraryRow[] {
  const games = payload?.response?.games
  if (!Array.isArray(games)) return []
  return games.map((g: any) => ({
    steam_id: steamId,
    app_id: g.appid,
    name: g.name ?? '',
    kind: 'owned' as const,
    playtime_forever: g.playtime_forever ?? 0,
    playtime_2weeks: g.playtime_2weeks ?? 0,
  }))
}

export async function fetchOwnedGames(steamId: string): Promise<LibraryRow[]> {
  const url = new URL(`${API}/IPlayerService/GetOwnedGames/v1/`)
  url.searchParams.set('key', process.env.STEAM_API_KEY!)
  url.searchParams.set('steamid', steamId)
  url.searchParams.set('include_played_free_games', '1')
  url.searchParams.set('include_appinfo', '1')
  const res = await fetch(url)
  if (!res.ok) return []
  return parseOwnedGames(await res.json(), steamId)
}

const ASSET_BASE = 'https://shared.cloudflare.steamstatic.com/store_item_assets/'

export type StoreItem = { app_id: number; name: string; header_image: string | null }

function headerFromAssets(assets: any): string | null {
  if (!assets?.asset_url_format || !assets?.header) return null
  return ASSET_BASE + String(assets.asset_url_format).split('${FILENAME}').join(assets.header)
}

export function parseStoreItems(payload: any): StoreItem[] {
  const items = payload?.response?.store_items
  if (!Array.isArray(items)) return []
  return items
    .filter((it: any) => it.appid && it.name)
    .map((it: any) => ({ app_id: it.appid, name: it.name, header_image: headerFromAssets(it.assets) }))
}

/** Batch-resolve name + header image for app ids (wishlist entries arrive bare). */
export async function fetchGameInfo(appIds: number[]): Promise<Map<number, StoreItem>> {
  const out = new Map<number, StoreItem>()
  for (let i = 0; i < appIds.length; i += 200) {
    const chunk = appIds.slice(i, i + 200)
    const body = { ids: chunk.map((a) => ({ appid: a })), context: { language: 'english', country_code: 'US' }, data_request: { include_basic_info: true, include_assets: true } }
    const url = new URL(`${API}/IStoreBrowseService/GetItems/v1/`)
    url.searchParams.set('input_json', JSON.stringify(body))
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      for (const it of parseStoreItems(await res.json())) out.set(it.app_id, it)
    } catch { /* best-effort */ }
  }
  return out
}

export async function fetchWishlist(steamId: string): Promise<LibraryRow[]> {
  const url = new URL(`${API}/IWishlistService/GetWishlist/v1/`)
  url.searchParams.set('key', process.env.STEAM_API_KEY!)
  url.searchParams.set('steamid', steamId)
  const res = await fetch(url)
  if (!res.ok) return []
  const items = (await res.json())?.response?.items ?? []
  return items.map((it: any) => ({
    steam_id: steamId, app_id: it.appid, name: '', kind: 'wishlist' as const,
    playtime_forever: 0, playtime_2weeks: 0,
  }))
}
