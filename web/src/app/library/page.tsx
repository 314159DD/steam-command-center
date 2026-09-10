import { getSteamId } from '@/lib/session'
import { getLibrary } from '@/lib/queries'
import { TopNav } from '@/components/TopNav'
import { LibraryBrowser } from '@/components/LibraryBrowser'
import type { LibraryRow } from '@/lib/library'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const steamId = await getSteamId()
  if (!steamId) {
    return (
      <>
        <TopNav persona={null} active="/library" />
        <div className="barhead">My Games</div>
        <div style={{ padding: 18, color: 'var(--dim)' }}>
          <a href="/api/auth/login" style={{ color: 'var(--yellow)' }}>Sign in through Steam</a> to see your library.
        </div>
      </>
    )
  }
  const rows = (await getLibrary(steamId)) as LibraryRow[]
  return (
    <>
      <TopNav persona="You" active="/library" />
      <div className="barhead">My Games · your full Steam library</div>
      <LibraryBrowser rows={rows} />
    </>
  )
}
