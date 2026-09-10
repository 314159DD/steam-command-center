type Ach = { achieved: number; total: number; pct: number | null } | null | undefined

export function AchievementBadge({ ach }: { ach: Ach }) {
  if (!ach || !ach.total) return null
  const remaining = ach.total - ach.achieved
  const done = remaining === 0
  const near = !done && ach.achieved > 0 && remaining <= 3
  const color = done ? 'var(--yellow)' : near ? '#cfb53b' : 'var(--dim)'
  const label = done
    ? 'ACH 100% ✓'
    : near
      ? `ACH ${remaining} from 100%`
      : `ACH ${ach.pct ?? Math.round((ach.achieved / ach.total) * 100)}%`
  return (
    <span title={`${ach.achieved}/${ach.total} achievements unlocked`}
      style={{ fontSize: 8, fontWeight: 'bold', color, border: `1px solid ${color}55`, borderRadius: 2, padding: '0 3px', flex: 'none', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}
