import { getSteamId } from '@/lib/session'
import { getNewReleases, getDiscovery, getMostPlayed, getUpdatesForUser, getPrefs, getActionDigest, getPriceDrops } from '@/lib/queries'
import { applyDiscoveryFilters, rankNewReleases } from '@/lib/filters'
import { groupUpdatesByGame } from '@/lib/updates'
import { DigestStrip } from '@/components/DigestStrip'
import { PriceDrops } from '@/components/PriceDrops'
import { TopNav } from '@/components/TopNav'
import { DiscoveryStrip } from '@/components/DiscoveryStrip'
import { NewReleasesSpotlight } from '@/components/NewReleasesSpotlight'
import { UpdatedFeed } from '@/components/UpdatedFeed'
import { FilterChips } from '@/components/FilterChips'
import { ImportButton } from '@/components/ImportButton'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const steamId = await getSteamId()
  const prefs = steamId ? await getPrefs(steamId) : { toggles: { quality: true, taste: true, my_games: true, global: false }, tag_weights: {} }

  const persona: string | null = steamId ? 'You' : null

  const [newReleasesRaw, trending, topSellers, mostPlayed, updates, digest, priceDrops] = await Promise.all([
    getNewReleases(steamId), getDiscovery('trending'), getDiscovery(['top_seller', 'special']),
    getMostPlayed(15), steamId ? getUpdatesForUser(steamId) : Promise.resolve([]),
    steamId ? getActionDigest(steamId) : Promise.resolve([]),
    steamId ? getPriceDrops(steamId) : Promise.resolve([]),
  ])

  const w = prefs.tag_weights as Record<string, number>
  const filt = (g: any[]) => applyDiscoveryFilters(g as any, w, prefs.toggles as any)
  const newRel = rankNewReleases(newReleasesRaw as any, w)
  const groups = groupUpdatesByGame(updates as any[])

  return (
    <>
      <TopNav persona={persona} active="/" />
      <NewReleasesSpotlight games={newRel as any} target={12} />
      <DigestStrip items={digest} />
      <PriceDrops drops={priceDrops as any} />
      <DiscoveryStrip columns={[
        { id: 'mostplayed', title: 'MOST PLAYED', tone: 'bronze', games: (mostPlayed as any[]).map((r) => ({
            app_id: r.app_id, name: r.name, tags: [], review_score: null, header_image: r.header_image,
            player_count: r.player_count, prev_count: r.prev_count })) },
        { id: 'trending', title: 'TRENDING NOW', tone: 'silver', games: filt(trending).slice(0, 15) },
        { id: 'topsellers', title: 'TOP SELLERS / SPECIALS', tone: 'gold', games: filt(topSellers).slice(0, 15) },
      ]} />

      <div className="barhead" id="updates">Recently Updated · Your Library &amp; Wishlist</div>
      <div style={{ padding: '10px 18px 16px' }}>
        {steamId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <ImportButton />
            <FilterChips initial={prefs.toggles as any} />
          </div>
        )}
        <UpdatedFeed groups={groups} />
      </div>
    </>
  )
}
