// Ported from the Python collector (classifier.py + steam_news.py) so the web
// import route can crawl the signed-in user's library news on demand, instead
// of waiting for the 30-min collector cron.

export type Classification = 'MAJOR' | 'UPDATE' | 'HOTFIX' | 'CONTENT'

const HOTFIX = /\b(hotfix|crash\s*fix|quick\s*fix|emergency)\b/i
const MAJOR = /\b(major update|out of early access|full release|expansion|overhaul|season\s*\d+|biggest update)\b|\bv?\d+\.0\b/i
const CONTENT = /\b(dlc|new map|new hero|new character|new content|new system|new ship|adds?\s+\d+|new\s+\w+\s+(map|mode|hero|character|content))\b/i

export function classify(title: string, body: string): Classification {
  const text = `${title || ''} ${body || ''}`
  if (HOTFIX.test(text)) return 'HOTFIX'
  if (MAJOR.test(text)) return 'MAJOR'
  if (CONTENT.test(text)) return 'CONTENT'
  return 'UPDATE'
}

const IMG_TAG = /\[img\][\s\S]*?\[\/img\]/g
const BBCODE = /\[\/?[^\]]+\]/g
const CLAN_IMG = /\{STEAM_CLAN_IMAGE\}\S*/g
const TOKEN = /\{[A-Z0-9_]+\}/g
const HTML_TAG = /<[^>]+>/g
const WS = /\s+/g

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
}

/** Clean Steam news bodies: strips bbcode, raw HTML, clan-image tokens, and decodes basic entities. */
export function stripBbcode(text: string): string {
  return (text || '')
    .replace(IMG_TAG, '')
    .replace(CLAN_IMG, '')
    .replace(TOKEN, '')
    .replace(BBCODE, '')
    .replace(HTML_TAG, '')
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;/g, (m) => ENTITIES[m] ?? m)
    .replace(WS, ' ')
    .trim()
}

export type UpdateRow = {
  gid: string; app_id: number; title: string; body: string
  url: string | null; classification: Classification; posted_at: string | null
}

export function parseNewsItems(payload: any, appId: number): UpdateRow[] {
  const items = payload?.appnews?.newsitems
  if (!Array.isArray(items)) return []
  return items.map((it: any) => {
    const title = it.title ?? ''
    const body = stripBbcode(it.contents ?? '')
    return {
      gid: String(it.gid),
      app_id: appId,
      title,
      body,
      url: it.url ?? null,
      classification: classify(title, body),
      posted_at: it.date ? new Date(it.date * 1000).toISOString() : null,
    }
  })
}

const API = 'https://api.steampowered.com'

/** Fetch + classify recent news for one app. Returns [] on any failure (per-app isolation). */
export async function fetchAppNews(appId: number, count = 5): Promise<UpdateRow[]> {
  try {
    const url = new URL(`${API}/ISteamNews/GetNewsForApp/v2/`)
    url.searchParams.set('appid', String(appId))
    url.searchParams.set('count', String(count))
    url.searchParams.set('maxlength', '1500')
    const res = await fetch(url)
    if (!res.ok) return []
    return parseNewsItems(await res.json(), appId)
  } catch {
    return []
  }
}
