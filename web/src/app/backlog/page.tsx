import { getSteamId } from '@/lib/session'
import { getBacklog } from '@/lib/queries'
import { TopNav } from '@/components/TopNav'
import { GameThumb } from '@/components/GameThumb'
import { HoverLink } from '@/components/HoverPreview'
import { DeckBadge } from '@/components/DeckBadge'
import { PriceTag } from '@/components/PriceTag'

export const dynamic = 'force-dynamic'

export default async function BacklogPage() {
  const steamId = await getSteamId()
  if (!steamId) {
    return (
      <>
        <TopNav persona={null} active="/backlog" />
        <div className="barhead">Deck Backlog</div>
        <div style={{ padding: 18, color: 'var(--dim)' }}>Sign in through Steam and import your library to see your Deck-ready backlog.</div>
      </>
    )
  }
  const games = await getBacklog(steamId)
  return (
    <>
      <TopNav persona="You" active="/backlog" />
      {(() => {
        const totalH = games.reduce((s: number, g: any) => s + (g.hltb_main || 0), 0)
        return <div className="barhead">Deck Backlog · barely played, runs great on Deck{totalH > 0 ? ` · ~${totalH}h to clear` : ''}</div>
      })()}
      <div style={{ padding: '8px 18px 24px', maxWidth: 820 }}>
        {games.length === 0 && <div style={{ color: 'var(--dim)', padding: 10 }}>Nothing here yet - import your library, and this fills with highly-rated owned games you haven&apos;t started that run well on Steam Deck.</div>}
        {games.map((g: any, i: number) => (
          <HoverLink key={g.app_id} appId={g.app_id} href={`/game/${g.app_id}`}
             style={{ display: 'flex', gap: 12, padding: '8px 4px', borderBottom: '1px solid #2a2d22', textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
            <span style={{ width: 22, textAlign: 'right', color: 'var(--dim)', flex: 'none', fontSize: 12 }}>{i + 1}</span>
            <GameThumb appId={g.app_id} stored={g.header_image} name={g.name} w={92} h={43} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#e7e9da', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
              <div style={{ fontSize: 10, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#6db86d', fontWeight: 'bold' }}>{g.best_score}</span>
                {g.hltb_main ? <span style={{ color: '#cdb46a' }}>≈{g.hltb_main}h</span> : null}
                <span>{g.playtime_forever > 0 ? `${g.playtime_forever}m played` : 'unplayed'}</span>
                <DeckBadge tier={g.proton_tier} />
              </div>
            </div>
            <PriceTag price={g.itad_price_cents} atl={g.itad_atl_cents} cut={g.itad_cut} shop={g.itad_shop} />
          </HoverLink>
        ))}
      </div>
    </>
  )
}
