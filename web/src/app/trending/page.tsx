import { getSteamId } from '@/lib/session'
import { getDiscovery, getPrefs } from '@/lib/queries'
import { applyDiscoveryFilters } from '@/lib/filters'
import { TopNav } from '@/components/TopNav'
import { GameList } from '@/components/GameList'

export const dynamic = 'force-dynamic'

const DEFAULT_PREFS = { toggles: { quality: true, taste: true, my_games: true, global: false }, tag_weights: {} }

export default async function TrendingPage() {
  const steamId = await getSteamId()
  const prefs = steamId ? await getPrefs(steamId) : DEFAULT_PREFS
  const games = await getDiscovery('trending', 60)
  const filtered = applyDiscoveryFilters(games as any, prefs.tag_weights as any, prefs.toggles as any).slice(0, 40)
  return (
    <>
      <TopNav persona={steamId ? 'You' : null} active="/trending" />
      <div className="barhead">Trending Now</div>
      <div style={{ padding: '8px 18px 24px' }}><GameList games={filtered as any} /></div>
    </>
  )
}
