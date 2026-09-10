import { notFound } from 'next/navigation'
import { getSteamId } from '@/lib/session'
import { getGameDetail } from '@/lib/queries'
import { TopNav } from '@/components/TopNav'
import { GameThumb } from '@/components/GameThumb'
import { DeckBadge } from '@/components/DeckBadge'
import { ReviewTrend } from '@/components/ReviewTrend'
import { PriceTag } from '@/components/PriceTag'
import { formatOwners } from '@/lib/format'
import { stripBbcode } from '@/lib/news'
import { storeUrl, openCriticSearchUrl } from '@/lib/steam-urls'

export const dynamic = 'force-dynamic'

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  if (mins < 1440) return `${Math.floor(mins / 60)}h`
  return `${Math.floor(mins / 1440)}d`
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ color: '#e7e9da', fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}

export default async function GamePage({ params }: { params: Promise<{ appid: string }> }) {
  const { appid } = await params
  const appId = Number(appid)
  if (!Number.isFinite(appId)) notFound()
  const steamId = await getSteamId()
  const data = await getGameDetail(appId, steamId)
  if (!data) notFound()
  const { game, news, currentPlayers, lib, ach, builds, achList } = data
  const tags: string[] = game.tags ?? []

  return (
    <>
      <TopNav persona={steamId ? 'You' : null} />
      <div style={{ padding: '14px 18px 28px', maxWidth: 940, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <GameThumb appId={game.app_id} stored={game.header_image} name={game.name} w={300} h={140} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, color: '#fff' }}>{game.name}</h1>
              {lib && <span style={{ fontSize: 10, color: 'var(--gold)', border: '1px solid #6f5e36', padding: '1px 5px' }}>
                {lib.kind === 'owned' ? `OWNED · ${Math.round(lib.playtime_forever / 60)}h` : 'WISHLIST'}
              </span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <DeckBadge tier={game.proton_tier} />
              <ReviewTrend pct={game.recent_review_pct} trend={game.review_trend} />
              {(game.sub_names ?? []).map((s: string) => (
                <span key={s} style={{ fontSize: 9, fontWeight: 'bold', color: '#4fa3d1', border: '1px solid #4fa3d155', borderRadius: 2, padding: '0 4px' }}>{s.toUpperCase()}</span>
              ))}
              {game.bundle_count > 0 && <span title={game.bundle_name ?? undefined} style={{ fontSize: 9, fontWeight: 'bold', color: '#b07fd1', border: '1px solid #b07fd155', borderRadius: 2, padding: '0 4px' }}>IN A BUNDLE</span>}
              {!game.is_released && <span style={{ fontSize: 9, color: '#cdb46a', border: '1px solid #6f5e3655', padding: '0 4px' }}>UNRELEASED</span>}
            </div>
            {(game.itad_price_cents != null || game.itad_atl_cents != null) && (
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <PriceTag price={game.itad_price_cents} atl={game.itad_atl_cents} cut={game.itad_cut} shop={game.itad_shop} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 22, marginTop: 14, flexWrap: 'wrap' }}>
              {game.price_cents != null && game.itad_price_cents == null && <Stat label="PRICE" value={`€${(game.price_cents / 100).toFixed(2)}`} />}
              {game.review_score != null && <Stat label="REVIEWS" value={`${game.review_score}%${game.review_count ? ` · ${game.review_count.toLocaleString()}` : ''}`} />}
              {game.metacritic != null && <Stat label="METACRITIC" value={<span style={{ color: game.metacritic >= 75 ? '#6db86d' : game.metacritic >= 50 ? '#cfb53b' : '#c0392b' }}>{game.metacritic}</span>} />}
              {game.opencritic != null && <Stat label="OPENCRITIC" value={
                <a href={openCriticSearchUrl(game.name)} target="_blank" rel="noreferrer" aria-label={`Search OpenCritic for ${game.name}`} title="Search OpenCritic" style={{ textDecoration: 'none' }}>
                  <span style={{ color: game.opencritic >= 75 ? '#6db86d' : game.opencritic >= 50 ? '#cfb53b' : '#c0392b' }}>{game.opencritic}</span>
                  <span aria-hidden="true" style={{ color: 'var(--dim)', fontSize: 10, marginLeft: 3 }}>↗</span>
                </a>} />}
              {game.deck_verified && <Stat label="STEAM DECK" value={
                <span style={{ color: game.deck_verified === 'verified' ? '#6db86d' : game.deck_verified === 'playable' ? '#cfb53b' : '#c0392b', textTransform: 'capitalize' }}>
                  {game.deck_verified === 'verified' ? '✓ Verified' : game.deck_verified === 'playable' ? '~ Playable' : '✗ Unsupported'}
                </span>} />}
              {currentPlayers != null && <Stat label="PLAYING NOW" value={currentPlayers.toLocaleString()} />}
              {formatOwners(game.owners_estimate) && <Stat label="OWNERS (EST.)" value={`~${formatOwners(game.owners_estimate)}`} />}
              {game.spy_avg_playtime ? <Stat label="AVG PLAYTIME" value={`${Math.round(game.spy_avg_playtime / 60)}h`} /> : null}
              {game.hltb_main ? <Stat label="TO BEAT" value={`≈${game.hltb_main}h${game.hltb_completionist ? ` · ${game.hltb_completionist}h 100%` : ''}`} /> : null}
            </div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: 5, marginTop: 12, flexWrap: 'wrap' }}>
                {tags.slice(0, 8).map((t) => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <a href={storeUrl(game.app_id)} target="_blank" rel="noreferrer" className="valve" style={{ color: 'var(--yellow)' }}>Open in Steam ↗</a>
            </div>
          </div>
        </div>

        {/* Achievements */}
        {ach && ach.total > 0 && (
          <>
            <div className="barhead" style={{ marginTop: 22 }}>Your Achievements</div>
            <div style={{ padding: '10px 4px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: ach.achieved === ach.total ? 'var(--yellow)' : '#e7e9da' }}>
                {ach.achieved} / {ach.total}
                <span style={{ fontSize: 12, color: 'var(--dim)', marginLeft: 8 }}>({ach.pct}%)</span>
              </div>
              <div style={{ flex: 1, minWidth: 160, height: 8, background: '#1c1f16', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${ach.pct ?? 0}%`, height: '100%', background: ach.achieved === ach.total ? 'var(--yellow)' : '#8a7a3a' }} />
              </div>
              {ach.achieved === ach.total
                ? <span style={{ color: 'var(--yellow)', fontWeight: 'bold' }}>Perfect game ✓</span>
                : ach.total - ach.achieved <= 3 && ach.achieved > 0
                  ? <span style={{ color: '#cfb53b' }}>Just {ach.total - ach.achieved} from 100%!</span>
                  : null}
              {ach.rarest_name && <span style={{ fontSize: 11, color: 'var(--dim)' }}>Rarest unlocked: <b style={{ color: '#cdb46a' }}>{ach.rarest_name}</b> ({ach.rarest_pct}%)</span>}
            </div>
            {achList && achList.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 4px 10px' }}>
                {achList.slice(0, 48).map((a: any) => (
                  <div key={a.apiname} title={`${a.name}${a.global_pct != null ? ` · ${a.global_pct}% of players` : ''}${a.achieved ? '' : ' (locked)'}`}
                    style={{ width: 40, height: 40, position: 'relative', opacity: a.achieved ? 1 : 0.35 }}>
                    {a.icon && <img src={a.icon} alt="" width={40} height={40} style={{ borderRadius: 3, border: a.achieved ? '1px solid #6f5e36' : '1px solid #2a2d22' }} />}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Builds (PICS watcher) */}
        {(game.current_build_id || (builds && builds.length > 0)) && (
          <>
            <div className="barhead" style={{ marginTop: 22 }}>Builds</div>
            <div style={{ padding: '8px 4px', fontSize: 12 }}>
              {game.current_build_id && <div style={{ color: '#e7e9da' }}>Current build <b style={{ color: 'var(--gold)' }}>{game.current_build_id}</b></div>}
              {builds && builds.length > 1 && (
                <div style={{ marginTop: 6, color: 'var(--dim)' }}>
                  {builds.slice(0, 5).map((b: any) => (
                    <div key={b.build_id}>build {b.build_id} · {new Date(b.detected_at).toISOString().slice(0, 10)}</div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* News timeline */}
        <div className="barhead" style={{ marginTop: 22 }}>Update History</div>
        {news.length === 0 && <div style={{ color: 'var(--dim)', padding: 10 }}>No tracked updates yet.</div>}
        {news.map((u: any) => (
          <div key={u.gid} style={{ display: 'flex', gap: 10, padding: '8px 4px', borderBottom: '1px solid #2a2d22' }}>
            <span className={`badge ${u.classification}`} style={{ width: 62, flex: 'none' }}>{u.classification}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'bold', color: '#e7e9da' }}>
                {u.url ? <a href={u.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{u.title}</a> : u.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>{stripBbcode(u.body ?? '').slice(0, 240)}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--dim)', flex: 'none' }}>{ago(u.posted_at)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
