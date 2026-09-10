import { getSteamId } from '@/lib/session'
import { getNewReleases, getPrefs } from '@/lib/queries'
import { rankNewReleases } from '@/lib/filters'
import { NewReleasesSpotlight } from '@/components/NewReleasesSpotlight'
import { TopNav } from '@/components/TopNav'

export const dynamic = 'force-dynamic'

const DEFAULT_PREFS = { toggles: { quality: true, taste: true, my_games: true, global: false }, tag_weights: {} }

export default async function NewReleasesPage() {
  const steamId = await getSteamId()
  const prefs = steamId ? await getPrefs(steamId) : DEFAULT_PREFS
  const raw = await getNewReleases(steamId)
  const ranked = rankNewReleases(raw as any, prefs.tag_weights as any)
  return (
    <>
      <TopNav persona={steamId ? 'You' : null} active="/new-releases" />
      <NewReleasesSpotlight games={ranked as any} target={ranked.length} />
    </>
  )
}
