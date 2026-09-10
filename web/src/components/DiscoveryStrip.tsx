'use client'
import { useState } from 'react'
import { GameThumb } from './GameThumb'
import { HoverLink } from './HoverPreview'

type Game = { app_id: number; name: string; tags: string[]; review_score: number | null; price_cents?: number | null; header_image?: string | null; player_count?: number | null; prev_count?: number | null }
type Col = { title: string; tone: 'bronze' | 'silver' | 'gold'; games: Game[]; id?: string }
const toneColor = { bronze: '#b8966a', silver: '#cfd2c2', gold: 'var(--yellow)' }

export function DiscoveryStrip({ columns }: { columns: Col[] }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggle = (t: string) => setCollapsed((s) => ({ ...s, [t]: !s[t] }))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22, padding: '16px 18px 6px', alignItems: 'start' }}>
      {columns.map((col) => {
        const isCollapsed = collapsed[col.title]
        return (
          <div key={col.title} id={col.id} style={{ minWidth: 0 }}>
            <h4 onClick={() => toggle(col.title)}
                style={{ margin: '0 0 6px', color: toneColor[col.tone], fontSize: 13, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--dim)', width: 8 }}>{isCollapsed ? '▶' : '▼'}</span>{col.title}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--dim)' }}>{col.games.length}</span>
            </h4>
            <div style={{ height: 1, background: '#4a4d3c', marginBottom: 7 }} />
            {!isCollapsed && col.games.length === 0 && <div style={{ color: 'var(--dim)', fontSize: 11, padding: '6px 0' }}>Nothing here yet.</div>}
            {!isCollapsed && col.games.map((g) => (
              <HoverLink key={g.app_id} appId={g.app_id} href={`/game/${g.app_id}`}
                 style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #2a2d22', textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
                <GameThumb appId={g.app_id} stored={g.header_image} name={g.name} w={60} h={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#dfe1d3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--dim)' }}>
                    {g.player_count != null
                      ? `${g.player_count.toLocaleString()} playing`
                      : (g.review_score ? `${g.review_score}%` : '-')}
                  </div>
                </div>
                {g.player_count != null
                  ? (() => { const p = g.prev_count ? Math.round(((g.player_count! - g.prev_count) / g.prev_count) * 100) : null
                      return p != null ? <span className={p >= 0 ? 'up' : 'down'} style={{ fontVariantNumeric: 'tabular-nums' }}>{p >= 0 ? '▲' : '▼'}{Math.abs(p)}%</span> : null })()
                  : (g.price_cents != null && <div style={{ color: 'var(--gold)', fontWeight: 'bold' }}>€{(g.price_cents / 100).toFixed(2)}</div>)}
              </HoverLink>
            ))}
          </div>
        )
      })}
    </div>
  )
}
