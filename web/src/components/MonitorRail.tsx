import { GameThumb } from './GameThumb'
import { HoverLink } from './HoverPreview'

type Row = { app_id: number; name: string; player_count: number; prev_count: number | null; header_image?: string | null }

function momentum(cur: number, prev: number | null) {
  if (!prev) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  return pct
}

export function MonitorRail({ rows }: { rows: Row[] }) {
  return (
    <div style={{ background: 'var(--panel2)', border: '1px solid #20231a', padding: 9 }}>
      <div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 5 }}>MONITOR · Most Played, live</div>
      {rows.map((r) => {
        const pct = momentum(r.player_count, r.prev_count)
        return (
          <HoverLink key={r.app_id} appId={r.app_id} href={`/game/${r.app_id}`}
             style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 2px', borderBottom: '1px solid #2a2d22', textDecoration: 'none', color: 'inherit' }}>
            <GameThumb appId={r.app_id} stored={r.header_image} name={r.name} w={38} h={18} />
            <b style={{ flex: 1, minWidth: 0, color: '#dfe1d3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</b>
            <span style={{ width: 72, flex: 'none', textAlign: 'right', color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{r.player_count.toLocaleString()}</span>
            <span className={pct != null ? (pct >= 0 ? 'up' : 'down') : undefined}
                  style={{ width: 46, flex: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {pct != null ? `${pct >= 0 ? '▲' : '▼'}${Math.abs(pct)}%` : ''}
            </span>
          </HoverLink>
        )
      })}
    </div>
  )
}
