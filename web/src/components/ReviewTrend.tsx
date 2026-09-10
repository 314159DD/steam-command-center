// Recent review sentiment vs lifetime - "are reviews trending up/down right now".
export function ReviewTrend({ pct, trend }: { pct?: number | null; trend?: string | null }) {
  if (pct == null || !trend) return null
  const color = trend === 'up' ? '#6db86d' : trend === 'down' ? '#c0392b' : 'var(--dim)'
  const arrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '→'
  return (
    <span title={`Recent reviews ${pct}% positive (${trend} vs lifetime)`}
      style={{ fontSize: 8, fontWeight: 'bold', color, border: `1px solid ${color}55`, borderRadius: 2, padding: '0 3px', flex: 'none', whiteSpace: 'nowrap' }}>
      REV {pct}%{arrow}
    </span>
  )
}
