'use client'
import { useMemo, useState } from 'react'
import { GameThumb } from './GameThumb'
import { HoverLink } from './HoverPreview'
import { DeckBadge } from './DeckBadge'
import { PriceTag } from './PriceTag'
import { sortLibrary, filterByKind, type LibraryRow, type SortKey } from '@/lib/library'

type Kind = 'all' | 'owned' | 'wishlist'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'hours', label: 'Hours played' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'completion', label: 'Completion %' },
  { key: 'deck', label: 'Steam Deck tier' },
  { key: 'review', label: 'Review score' },
  { key: 'price', label: 'Price (cheapest)' },
]

const KINDS: { key: Kind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'owned', label: 'Owned' },
  { key: 'wishlist', label: 'Wishlist' },
]

export function LibraryBrowser({ rows }: { rows: LibraryRow[] }) {
  const [kind, setKind] = useState<Kind>('all')
  const [sort, setSort] = useState<SortKey>('hours')

  const view = useMemo(() => sortLibrary(filterByKind(rows, kind), sort), [rows, kind, sort])

  const ownedCount = rows.filter((r) => r.kind === 'owned').length
  const wishlistCount = rows.filter((r) => r.kind === 'wishlist').length

  return (
    <div style={{ padding: '8px 18px 24px', maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {KINDS.map((k) => (
            <button key={k.key} onClick={() => setKind(k.key)}
              style={{
                fontSize: 11, fontWeight: 'bold', letterSpacing: 0.4, cursor: 'pointer',
                padding: '4px 10px', borderRadius: 3, whiteSpace: 'nowrap',
                border: `1px solid ${kind === k.key ? 'var(--gold)' : '#3a3e30'}`,
                background: kind === k.key ? 'var(--gold)' : '#31352a',
                color: kind === k.key ? '#1c1f16' : '#e7e9da',
              }}>
              {k.label}
            </button>
          ))}
        </div>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--dim)' }}>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              background: '#282e22', color: '#e7e9da', border: '1px solid var(--gold)',
              borderRadius: 3, padding: '4px 8px', fontSize: 12, outline: 'none', cursor: 'pointer',
            }}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>
        {rows.length} games · {ownedCount} owned · {wishlistCount} wishlist
      </div>

      {view.length === 0 && (
        <div style={{ color: 'var(--dim)', padding: 10 }}>
          Nothing here yet - sign in and import your library to see your games.
        </div>
      )}

      {view.map((g) => (
        <HoverLink key={`${g.kind}-${g.app_id}`} appId={g.app_id} href={`/game/${g.app_id}`}
           style={{ display: 'flex', gap: 12, padding: '8px 4px', borderBottom: '1px solid #2a2d22', textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
          <GameThumb appId={g.app_id} stored={g.header_image} name={g.name} w={92} h={43} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#e7e9da', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
            <div style={{ fontSize: 10, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="chip" style={{ color: g.kind === 'owned' ? '#6db86d' : '#cdb46a' }}>
                {g.kind === 'owned' ? 'OWNED' : 'WISHLIST'}
              </span>
              {g.kind === 'owned' && (
                <span>{g.playtime_forever ? `${Math.round(g.playtime_forever / 60)}h` : 'unplayed'}</span>
              )}
              {g.review_score != null && <span>{g.review_score}%</span>}
              {g.ach_pct != null && <span style={{ color: '#cdb46a' }}>{g.ach_pct}%✓</span>}
              <DeckBadge tier={g.proton_tier} />
            </div>
          </div>
          {(g.itad_price_cents != null || g.itad_atl_cents != null) &&
            <PriceTag price={g.itad_price_cents} atl={g.itad_atl_cents} cut={g.itad_cut} shop={g.itad_shop} />}
        </HoverLink>
      ))}
    </div>
  )
}
