import { getSteamId } from '@/lib/session'
import { getUpcomingReleases, getReleaseCalendar } from '@/lib/queries'
import { TopNav } from '@/components/TopNav'
import { GameThumb } from '@/components/GameThumb'
import { HoverLink } from '@/components/HoverPreview'
import { PriceTag } from '@/components/PriceTag'

export const dynamic = 'force-dynamic'

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmt(d: string) {
  const dt = new Date(d)
  return `${dt.getUTCDate()} ${MONTH[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}
function monthKey(d: string) {
  const dt = new Date(d)
  return `${MONTH[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
}

export default async function CalendarPage() {
  const steamId = await getSteamId()
  const [upcoming, wishlist] = await Promise.all([
    getUpcomingReleases(),
    steamId ? getReleaseCalendar(steamId) : Promise.resolve([] as any[]),
  ])

  let lastMonth = ''
  return (
    <>
      <TopNav persona={steamId ? 'You' : null} active="/calendar" />
      <div className="barhead">Upcoming Releases · OpenCritic</div>
      <div style={{ padding: '8px 18px 18px', maxWidth: 760 }}>
        {upcoming.length === 0 && <div style={{ color: 'var(--dim)', padding: 10 }}>No dated upcoming releases right now.</div>}
        {upcoming.map((g: any) => {
          const mk = monthKey(g.release_date)
          const header = mk !== lastMonth ? (lastMonth = mk) : null
          const href = g.steam_app_id ? `/game/${g.steam_app_id}` : (g.url || '#')
          const external = !g.steam_app_id
          return (
            <div key={`${g.game_name}-${g.release_date}`}>
              {header && <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 'bold', margin: '14px 0 4px', letterSpacing: 1 }}>{header.toUpperCase()}</div>}
              <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                 style={{ display: 'flex', gap: 12, padding: '7px 4px', borderBottom: '1px solid #2a2d22', textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
                <span style={{ width: 86, flex: 'none', color: '#cdb46a', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmt(g.release_date)}</span>
                {g.steam_app_id && <GameThumb appId={g.steam_app_id} stored={g.header_image} name={g.game_name} w={60} h={28} />}
                <span style={{ flex: 1, minWidth: 0, color: '#e7e9da', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.game_name}</span>
                <span style={{ fontSize: 9, color: 'var(--dim)', flex: 'none' }}>{external ? 'OpenCritic ↗' : 'details'}</span>
              </a>
            </div>
          )
        })}

        {steamId && wishlist.length > 0 && (
          <>
            <div className="barhead" style={{ marginTop: 22 }}>Your Wishlist · Coming Soon</div>
            {wishlist.map((g: any) => (
              <HoverLink key={g.app_id} appId={g.app_id} href={`/game/${g.app_id}`}
                 style={{ display: 'flex', gap: 12, padding: '7px 4px', borderBottom: '1px solid #2a2d22', textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
                <GameThumb appId={g.app_id} stored={g.header_image} name={g.name} w={60} h={28} />
                <span style={{ flex: 1, minWidth: 0, color: '#e7e9da', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                <span style={{ color: g._ts ? '#cdb46a' : 'var(--dim)', fontSize: 11, flex: 'none' }}>{g.release_date || 'TBA'}</span>
                <PriceTag price={g.itad_price_cents} atl={g.itad_atl_cents} cut={g.itad_cut} shop={g.itad_shop} />
              </HoverLink>
            ))}
          </>
        )}
      </div>
    </>
  )
}
