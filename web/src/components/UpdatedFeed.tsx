import { GameThumb } from './GameThumb'
import { HoverLink } from './HoverPreview'
import { ReviewTrend } from './ReviewTrend'
import { AchievementBadge } from './AchievementBadge'
import { PriceTag } from './PriceTag'
import { blurb } from '@/lib/updates'
import type { GameUpdateGroup } from '@/lib/updates'
import { isRecentBuild } from '@/lib/buildUtils'

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

const SECONDARY = 3 // other updates shown beneath the headline blurb

export function UpdatedFeed({ groups }: { groups: GameUpdateGroup[] }) {
  if (groups.length === 0) {
    return <div style={{ color: 'var(--dim)', padding: 8 }}>No recent updates in your library yet. Import your games to populate this feed.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map((g) => {
        const head = g.updates[0] // newest-first, the headline "What's New"
        const rest = g.updates.slice(1)
        const snippet = head ? blurb(head.body) : ''
        return (
          <div key={g.app_id} style={{ background: 'var(--panel2)', border: '1px solid #20231a', borderRadius: 3, padding: 8 }}>
            {/* Header: thumb · name · badges · tag · price */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <GameThumb appId={g.app_id} stored={g.header_image} name={g.name} w={72} h={34} />
              <HoverLink appId={g.app_id} href={`/game/${g.app_id}`}
                 style={{ flex: 1, minWidth: 0, fontWeight: 'bold', color: '#e7e9da', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</HoverLink>
              <ReviewTrend pct={g.recent_review_pct} trend={g.review_trend} />
              <AchievementBadge ach={g.ach} />
              {g.lib && <span style={{ fontSize: 9, color: 'var(--gold)', border: '1px solid #6f5e36', padding: '0 4px', flex: 'none', whiteSpace: 'nowrap' }}>
                {g.lib.kind === 'owned' ? `OWNED ${Math.round(g.lib.playtime_forever / 60)}h` : 'WISHLIST'}
              </span>}
              {g.latestBuild && isRecentBuild(g.latestBuild.detected_at, new Date()) && (
                <span style={{ fontSize: 9, color: 'var(--gold)', border: '1px solid #6f5e36', padding: '0 4px', flex: 'none', whiteSpace: 'nowrap' }}>
                  NEW BUILD #{g.latestBuild.build_id}
                </span>
              )}
            </div>

            {/* Headline blurb: newest update title (bold) + cleaned snippet - Steam "What's New" style */}
            {head && (
              <div style={{ marginTop: 7, paddingLeft: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span className={`badge ${head.classification}`} style={{ flex: 'none' }}>{head.classification}</span>
                  {head.url
                    ? <a href={head.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, fontWeight: 'bold', fontSize: 12, color: '#eef0e2', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{head.title}</a>
                    : <span style={{ flex: 1, minWidth: 0, fontWeight: 'bold', fontSize: 12, color: '#eef0e2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{head.title}</span>}
                  <span style={{ fontSize: 9, color: 'var(--dim)', flex: 'none' }}>{ago(head.posted_at)}</span>
                </div>
                {snippet && (
                  <div style={{
                    marginTop: 3, fontSize: 11, lineHeight: 1.4, color: '#c6c9b8',
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', maxHeight: '2.8em', wordBreak: 'break-word',
                  }}>{snippet}</div>
                )}
                {/* Prominent price/deal line */}
                <div style={{ marginTop: 5 }}>
                  <PriceTag price={g.itad_price_cents} atl={g.itad_atl_cents} cut={g.itad_cut} shop={g.itad_shop} />
                </div>
              </div>
            )}

            {/* Secondary: the game's other updates, compact */}
            {rest.length > 0 && (
              <div style={{ marginTop: 7, borderTop: '1px solid #23261c' }}>
                {rest.slice(0, SECONDARY).map((u) => (
                  <div key={u.gid} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '3px 0 3px 4px' }}>
                    <span className={`badge ${u.classification}`} style={{ width: 62, flex: 'none' }}>{u.classification}</span>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.url
                        ? <a href={u.url} target="_blank" rel="noreferrer" style={{ color: '#bcbfae', fontSize: 11, textDecoration: 'none' }}>{u.title}</a>
                        : <span style={{ color: '#bcbfae', fontSize: 11 }}>{u.title}</span>}
                    </div>
                    <span style={{ fontSize: 9, color: 'var(--dim)', flex: 'none' }}>{ago(u.posted_at)}</span>
                  </div>
                ))}
                {rest.length > SECONDARY && <div style={{ fontSize: 10, color: 'var(--dim)', padding: '2px 0 0 4px' }}>+{rest.length - SECONDARY} more update{rest.length - SECONDARY > 1 ? 's' : ''}</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
