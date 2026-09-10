'use client'

import { useState } from 'react'
import { GameThumb } from './GameThumb'
import { HoverLink } from './HoverPreview'
import { chunk, type DigestItem, type DigestReason } from '@/lib/digest'

const REASON_COLOR: Record<DigestReason['type'], string> = {
  atl: 'var(--yellow)', ach: '#cfb53b', patch: '#6db86d', sub: '#4fa3d1', spike: '#d18a4f', bundle: '#b07fd1',
}

const COLS = 3
const ROWS = 4
const PAGE = COLS * ROWS // 12 per page (3×4)

export function DigestStrip({ items }: { items: DigestItem[] }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1) // last flip direction, for the slide-in animation

  const flip = (delta: 1 | -1) => { setDir(delta); setPage((p) => p + delta) }

  const live = items.filter((it) => !dismissed.has(it.app_id))
  if (live.length === 0) return null

  const dismiss = (e: React.MouseEvent, appId: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDismissed((prev) => new Set(prev).add(appId)) // optimistic
    fetch('/api/digest/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId }),
    }).catch(() => {})
  }

  const renderCard = (it: DigestItem) => (
    <HoverLink key={it.app_id} appId={it.app_id} href={`/game/${it.app_id}`}
       style={{ position: 'relative', display: 'flex', gap: 10, padding: 8, background: 'var(--panel2)', border: '1px solid #2a2d22', borderRadius: 3, textDecoration: 'none', color: 'inherit' }}>
      <button onClick={(e) => dismiss(e, it.app_id)} aria-label="Dismiss"
              title="Dismiss - won't show again"
              style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, lineHeight: '16px', padding: 0,
                       background: 'transparent', border: 'none', color: 'var(--dim)', fontSize: 13, cursor: 'pointer', borderRadius: 2 }}>✕</button>
      <GameThumb appId={it.app_id} stored={it.header_image} name={it.name} w={84} h={39} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 'bold', color: '#e7e9da', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 16 }}>
          {it.name} <span style={{ fontSize: 8, color: 'var(--dim)' }}>{it.kind === 'owned' ? 'OWNED' : 'WISHLIST'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 3 }}>
          {it.reasons.map((r, i) => (
            <span key={i} style={{ fontSize: 11, color: REASON_COLOR[r.type], fontWeight: r.type === 'atl' ? 'bold' : 'normal' }}>• {r.label}</span>
          ))}
        </div>
      </div>
    </HoverLink>
  )

  const grid = (cards: DigestItem[], key?: React.Key, className?: string) => (
    <div key={key} className={className} style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gap: 10 }}>
      {cards.map(renderCard)}
    </div>
  )

  // Expanded: every actionable item at once, with a way back to the paged view.
  if (expanded) {
    return (
      <div style={{ padding: '10px 18px 8px' }}>
        {grid(live, 'all', 'digest-fade')}
        <div style={{ marginTop: 8 }}>
          <button className="chip" onClick={() => setExpanded(false)} style={{ cursor: 'pointer' }}>↤ Back to 3×4</button>
        </div>
      </div>
    )
  }

  // Paged: one 3×4 page at a time, flip with the side arrows.
  const pages = chunk(live, PAGE)
  const pageCount = pages.length
  const cur = Math.min(page, pageCount - 1)
  const arrow = (delta: -1 | 1, label: string, disabled: boolean) => (
    <button onClick={() => flip(delta)} disabled={disabled} aria-label={label} title={label}
            style={{ flex: 'none', width: 30, alignSelf: 'stretch', background: 'var(--panel2)', border: '1px solid #2a2d22',
                     borderRadius: 3, color: disabled ? '#3a3e30' : 'var(--gold)', fontSize: 18, fontWeight: 'bold',
                     cursor: disabled ? 'default' : 'pointer' }}>{delta < 0 ? '‹' : '›'}</button>
  )

  return (
    <div style={{ padding: '10px 18px 8px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        {pageCount > 1 && arrow(-1, 'Previous page', cur === 0)}
        {grid(pages[cur] ?? [], cur, dir > 0 ? 'digest-page-next' : 'digest-page-prev')}
        {pageCount > 1 && arrow(1, 'Next page', cur >= pageCount - 1)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        {pageCount > 1 && <span style={{ fontSize: 11, color: 'var(--dim)' }}>Page {cur + 1} / {pageCount}</span>}
        {live.length > PAGE && (
          <button className="chip" onClick={() => setExpanded(true)} style={{ cursor: 'pointer' }}>Show all {live.length}</button>
        )}
      </div>
    </div>
  )
}
