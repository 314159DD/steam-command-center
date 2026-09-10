import { getSteamId } from '@/lib/session'
import { getMostPlayed } from '@/lib/queries'
import { TopNav } from '@/components/TopNav'
import { MonitorRail } from '@/components/MonitorRail'

export const dynamic = 'force-dynamic'

export default async function MonitorPage() {
  const steamId = await getSteamId()
  const rows = await getMostPlayed(30)
  return (
    <>
      <TopNav persona={steamId ? 'You' : null} active="/monitor" />
      <div className="barhead">Monitor · Most Played (live)</div>
      <div style={{ padding: '8px 18px 24px', maxWidth: 620 }}><MonitorRail rows={rows as any} /></div>
    </>
  )
}
