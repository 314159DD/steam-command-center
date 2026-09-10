'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Users, Heart, Gamepad2, ShieldCheck, Tag, Star, ExternalLink } from 'lucide-react'
import { microtrailerUrl, compactCount, groupedCount, formatCardPrice, displayPlayerCount, hoverCardPosition } from '@/lib/hover-card'

type CardData = {
  app_id: number; name: string; header_image?: string | null; developer?: string | null
  release_date?: string | null; trailer_movie_id?: number | null; screenshots?: string[] | null
  spy_ccu?: number | null; igdb_follows?: number | null; tags?: string[] | null
  spy_tags?: Record<string, number> | null; has_vac?: boolean | null; family_sharing?: boolean | null
  review_score?: number | null; review_count?: number | null
  price_cents?: number | null; itad_price_cents?: number | null; itad_atl_cents?: number | null
  itad_cut?: number | null; proton_tier?: string | null; deck_verified?: string | null
  recent_review_pct?: number | null; review_trend?: string | null; playtime_forever?: number | null
  live_players?: number | null
  lib?: 'owned' | 'wishlist' | null
}

type Ctx = { show: (appId: number, rect: DOMRect) => void; hide: () => void }
const HoverCtx = createContext<Ctx | null>(null)
const cache = new Map<number, CardData | null>()
const iconRow: React.CSSProperties = { display: 'inline-flex', gap: 4, alignItems: 'center' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function useGameHover(appId: number) {
  const ctx = useContext(HoverCtx)
  const ref = useRef<HTMLAnchorElement>(null)
  return {
    ref,
    onMouseEnter: () => { if (ref.current && ctx) ctx.show(appId, ref.current.getBoundingClientRect()) },
    onMouseLeave: () => ctx?.hide(),
  }
}

export function HoverLink({ appId, href, children, style, className }: {
  appId: number; href: string; children: React.ReactNode
  style?: React.CSSProperties; className?: string
}) {
  const h = useGameHover(appId)
  return (
    <a ref={h.ref} href={href} style={style} className={className}
       onMouseEnter={h.onMouseEnter} onMouseLeave={h.onMouseLeave}>{children}</a>
  )
}

export function HoverPreviewProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ appId: number; rect: DOMRect } | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((appId: number, rect: DOMRect) => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setState({ appId, rect })
  }, [])
  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setState(null), 100)  // grace to move onto the card
  }, [])
  const cancelHide = useCallback(() => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])
  return (
    <HoverCtx.Provider value={{ show, hide }}>
      {children}
      {state && <GameHoverCard appId={state.appId} rect={state.rect} onEnter={cancelHide} onLeave={hide} />}
    </HoverCtx.Provider>
  )
}

function GameHoverCard({ appId, rect, onEnter, onLeave }: {
  appId: number; rect: DOMRect; onEnter: () => void; onLeave: () => void
}) {
  const [data, setData] = useState<CardData | null>(cache.get(appId) ?? null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (cache.has(appId)) { setData(cache.get(appId) ?? null); return }
    fetch(`/api/game-card/${appId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CardData | null) => { cache.set(appId, d); if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [appId])
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const W = 270, H = 360
  const pos = hoverCardPosition(
    { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
    { width: W, height: H },
    { width: window.innerWidth, height: window.innerHeight })
  const tags = data?.spy_tags ? Object.keys(data.spy_tags).slice(0, 5) : (data?.tags ?? []).slice(0, 5)
  const movieId = data?.trailer_movie_id
  const fallbackShot = data?.screenshots?.[0]
  const price = formatCardPrice(data?.itad_price_cents ?? data?.price_cents, data?.itad_atl_cents, data?.itad_cut)
  const deckLabel = data?.deck_verified
    ? `Deck: ${cap(data.deck_verified)}`
    : (data?.proton_tier && data.proton_tier !== 'unrated' ? `Proton: ${cap(data.proton_tier)}` : null)
  const players = displayPlayerCount(data?.live_players, data?.spy_ccu)

  return (
    <div onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: W, zIndex: 1000,
               background: 'var(--panel)', border: '1px solid #4a4d3c',
               boxShadow: '0 8px 24px rgba(0,0,0,.6)', fontSize: 12, color: 'var(--text)',
               opacity: shown ? 1 : 0, transition: 'opacity 80ms ease-out' }}>
      <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#0c0d09', overflow: 'hidden' }}>
        {movieId
          ? <video src={microtrailerUrl(movieId)} autoPlay muted loop playsInline
              poster={data?.header_image ?? undefined}
              onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none' }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (fallbackShot
              ? <img src={fallbackShot} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (data?.header_image &&
                  <img src={data.header_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />))}
      </div>
      <div style={{ padding: 8 }}>
        {!data ? <div style={{ color: 'var(--dim)' }}>Loading…</div> : <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <div style={{ fontWeight: 'bold', color: '#fff', fontSize: 13, lineHeight: 1.2, flex: 1 }}>{data.name}</div>
            {data.lib && <span style={{ fontSize: 9, color: 'var(--gold)', border: '1px solid #6f5e36',
              padding: '0 4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{data.lib}</span>}
          </div>
          {(data.developer || data.release_date) &&
            <div style={{ color: 'var(--dim)', fontSize: 11, marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[data.developer, data.release_date].filter(Boolean).join(' · ')}</div>}
          {(players != null || data.igdb_follows != null) &&
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
              {players != null && <span style={iconRow}><Users size={12} /> {groupedCount(players)}</span>}
              {data.igdb_follows != null && <span style={iconRow}><Heart size={12} /> {compactCount(data.igdb_follows)}</span>}
            </div>}
          {tags.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
            {tags.map((t) => <span key={t} style={{ fontSize: 10, color: 'var(--dim)',
              border: '1px solid #3a3d2e', padding: '0 5px', borderRadius: 2 }}>{t}</span>)}</div>}
          {(deckLabel || data.has_vac) &&
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 5 }}>
              {deckLabel && <span style={iconRow}><Gamepad2 size={12} /> {deckLabel}</span>}
              {data.has_vac && <span style={iconRow}><ShieldCheck size={12} /> VAC</span>}
            </div>}
          {price && <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6,
            color: 'var(--gold)', fontWeight: 'bold' }}><Tag size={12} /> {price}</div>}
          {data.review_score != null && data.review_count != null &&
            <div style={{ ...iconRow, marginTop: 4 }}><Star size={12} /> {data.review_score}% · {compactCount(data.review_count)} reviews</div>}
          <a href={`https://store.steampowered.com/app/${appId}`} target="_blank" rel="noreferrer"
             style={{ display: 'inline-flex', gap: 4, alignItems: 'center', color: 'var(--yellow)',
               textDecoration: 'none', marginTop: 6, fontSize: 11 }}><ExternalLink size={12} /> Store</a>
        </>}
      </div>
    </div>
  )
}
