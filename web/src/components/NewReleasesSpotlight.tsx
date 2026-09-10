'use client'
import { useState } from 'react'
import { GameThumb } from './GameThumb'
import { HoverLink } from './HoverPreview'

export type NewReleaseCard = {
  app_id: number; name: string; header_image?: string | null
  review_score?: number | null
  metacritic?: number | null; opencritic?: number | null; igdb_aggregated_rating?: number | null
  igdb_hypes?: number | null
  price_cents?: number | null; itad_price_cents?: number | null; itad_cut?: number | null
  released_at?: string | null
  lib?: 'owned' | 'wishlist' | null
}

const HYPE_THRESHOLD = 200

export function isHyped(g: { igdb_hypes?: number | null }): boolean {
  return (g.igdb_hypes ?? 0) >= HYPE_THRESHOLD
}

/** A subtle note shown only when the list is thin (some results, under target). */
export function tailNote(count: number, target: number): string | null {
  if (count <= 0 || count >= target) return null
  return "that's everything worth flagging right now"
}

/** Cycle an index by delta with wrap-around; returns 0 for an empty list. */
export function cycleIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0
  return (current + delta + length) % length
}

function bestCritic(g: NewReleaseCard): number | null {
  const best = Math.max(g.metacritic ?? 0, g.opencritic ?? 0, g.igdb_aggregated_rating ?? 0)
  return best > 0 ? Math.round(best) : null
}

function daysAgo(released_at?: string | null): string | null {
  if (!released_at) return null
  const d = Math.floor((Date.now() - new Date(released_at).getTime()) / 86_400_000)
  if (!Number.isFinite(d) || d < 0) return null
  return d === 0 ? 'today' : `${d}d ago`
}

function Meta({ g }: { g: NewReleaseCard }) {
  const critic = bestCritic(g)
  const price = g.itad_price_cents ?? g.price_cents
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
      {daysAgo(g.released_at) && <span>{daysAgo(g.released_at)}</span>}
      {g.review_score != null && <span style={{ color: '#6db86d' }}>{g.review_score}%</span>}
      {critic != null && <span style={{ color: 'var(--gold)' }}>★{critic}</span>}
      {isHyped(g) && <span style={{ color: 'var(--yellow)' }}>🔥 hyped</span>}
      {g.lib && <span style={{ textTransform: 'uppercase' }}>{g.lib}</span>}
      {price != null && <span style={{ marginLeft: 'auto', color: 'var(--gold)', fontWeight: 'bold' }}>€{(price / 100).toFixed(2)}</span>}
    </div>
  )
}

const arrowStyle: React.CSSProperties = {
  position: 'absolute', top: '42%', transform: 'translateY(-50%)', zIndex: 2,
  background: 'rgba(12,13,9,.72)', color: 'var(--text)', border: '1px solid #4a4d3c',
  cursor: 'pointer', fontSize: 18, lineHeight: 1, width: 30, height: 44,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

export function NewReleasesSpotlight({ games, target = 12 }: { games: NewReleaseCard[]; target?: number }) {
  const shown = games.slice(0, target)
  const [active, setActive] = useState(0)
  const note = tailNote(shown.length, target)

  if (shown.length === 0) {
    return (
      <div style={{ padding: '4px 18px 10px' }}>
        <div className="barhead" style={{ margin: '0 0 8px' }}>✦ New Releases Worth Checking Out</div>
        <div style={{ color: 'var(--dim)', fontSize: 12, padding: '6px 2px' }}>
          Nothing new clears the bar right now - check back in a day or two.
        </div>
      </div>
    )
  }

  const idx = active >= shown.length ? 0 : active   // guard if the list shrank
  const featured = shown[idx]
  const multi = shown.length > 1
  const move = (delta: number) => setActive((cur) => cycleIndex(cur, delta, shown.length))

  return (
    <div style={{ padding: '4px 18px 10px' }} tabIndex={0}
         onKeyDown={(e) => {
           if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
           else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
         }}>
      <div className="barhead" style={{ margin: '0 0 8px', textAlign: 'center' }}>✦ New Releases Worth Checking Out</div>

      <div style={{ position: 'relative', maxWidth: 600, margin: '0 auto' }}>
        <HoverLink appId={featured.app_id} href={`/game/${featured.app_id}`}
           style={{ display: 'block', textDecoration: 'none', color: 'inherit',
                    background: 'var(--panel2)', border: '1px solid #20231a', padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'center', background: '#0c0d09' }}>
            <GameThumb appId={featured.app_id} stored={featured.header_image} name={featured.name} w={580} h={271} />
          </div>
          <div style={{ color: '#dfe1d3', fontWeight: 'bold', fontSize: 15, marginTop: 8,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{featured.name}</div>
          <Meta g={featured} />
        </HoverLink>
        {multi && <>
          <button aria-label="Previous release" style={{ ...arrowStyle, left: 0 }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); move(-1) }}>‹</button>
          <button aria-label="Next release" style={{ ...arrowStyle, right: 0 }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); move(1) }}>›</button>
        </>}
      </div>

      {multi && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, margin: '8px auto 0', maxWidth: 600 }}>
          {shown.map((g, i) => (
            <button key={g.app_id} aria-label={g.name} onClick={() => setActive(i)}
              style={{ padding: 0, cursor: 'pointer', lineHeight: 0,
                       border: i === idx ? '1px solid var(--gold)' : '1px solid #20231a',
                       opacity: i === idx ? 1 : 0.6, background: '#11130d' }}>
              <GameThumb appId={g.app_id} stored={g.header_image} name={g.name} w={100} h={47} />
            </button>
          ))}
        </div>
      )}

      {note && <div style={{ color: 'var(--dim)', fontSize: 10, fontStyle: 'italic', padding: '6px 2px 0' }}>{note}</div>}
    </div>
  )
}
