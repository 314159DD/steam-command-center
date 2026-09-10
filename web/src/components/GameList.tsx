import { formatOwners } from '@/lib/format'
import { GameThumb } from './GameThumb'
import { HoverLink } from './HoverPreview'
import { DeckBadge } from './DeckBadge'
import { ReviewTrend } from './ReviewTrend'
import { PriceTag } from './PriceTag'

type Game = { app_id: number; name: string; review_score?: number | null; review_count?: number | null; price_cents?: number | null; header_image?: string | null; proton_tier?: string | null; owners_estimate?: string | null; recent_review_pct?: number | null; review_trend?: string | null; itad_price_cents?: number | null; itad_atl_cents?: number | null; itad_cut?: number | null; itad_shop?: string | null }

export function GameList({ games }: { games: Game[] }) {
  if (games.length === 0) return <div style={{ color: 'var(--dim)', padding: 12 }}>Nothing here yet - the collector will fill this on its next run.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {games.map((g, i) => (
        <HoverLink key={g.app_id} appId={g.app_id} href={`/game/${g.app_id}`}
           style={{ display: 'flex', gap: 12, padding: '8px 4px', borderBottom: '1px solid #2a2d22', textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
          <span style={{ width: 22, textAlign: 'right', color: 'var(--dim)', flex: 'none', fontSize: 12 }}>{i + 1}</span>
          <GameThumb appId={g.app_id} stored={g.header_image} name={g.name} w={92} h={43} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#e7e9da', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{g.review_score ? `${g.review_score}%` : '-'}{g.review_count ? ` · ${g.review_count.toLocaleString()} reviews` : ''}</span>
              {formatOwners(g.owners_estimate) && <span title="SteamSpy owner estimate">· {formatOwners(g.owners_estimate)} owners</span>}
              <DeckBadge tier={g.proton_tier} />
              <ReviewTrend pct={g.recent_review_pct} trend={g.review_trend} />
            </div>
          </div>
          {(g.itad_price_cents != null || g.itad_atl_cents != null)
            ? <PriceTag price={g.itad_price_cents} atl={g.itad_atl_cents} cut={g.itad_cut} shop={g.itad_shop} />
            : g.price_cents != null && <div style={{ color: 'var(--gold)', fontWeight: 'bold', flex: 'none' }}>€{(g.price_cents / 100).toFixed(2)}</div>}
        </HoverLink>
      ))}
    </div>
  )
}
