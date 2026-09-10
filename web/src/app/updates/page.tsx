import { getSteamId } from '@/lib/session'
import { getUpdatesForUser } from '@/lib/queries'
import { groupUpdatesByGame } from '@/lib/updates'
import { TopNav } from '@/components/TopNav'
import { UpdatedFeed } from '@/components/UpdatedFeed'
import { ImportButton } from '@/components/ImportButton'

export const dynamic = 'force-dynamic'

export default async function UpdatesPage() {
  const steamId = await getSteamId()
  if (!steamId) {
    return (
      <>
        <TopNav persona={null} active="/updates" />
        <div className="barhead">Recently Updated</div>
        <div style={{ padding: 18, color: 'var(--dim)' }}>Sign in through Steam to see your library updates.</div>
      </>
    )
  }
  const updates = await getUpdatesForUser(steamId, 300)
  const groups = groupUpdatesByGame(updates as any[])
  return (
    <>
      <TopNav persona="You" active="/updates" />
      <div className="barhead">Recently Updated · Your Library &amp; Wishlist</div>
      <div style={{ padding: '10px 18px 24px' }}>
        <div style={{ marginBottom: 10 }}><ImportButton /></div>
        <UpdatedFeed groups={groups} />
      </div>
    </>
  )
}
