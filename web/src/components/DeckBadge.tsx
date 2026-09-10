// ProtonDB / Steam Deck compatibility tier. Indicates Linux/Proton playability
// (a strong proxy for Steam Deck). Hidden for unrated/unknown.
const TIERS: Record<string, { label: string; color: string }> = {
  platinum: { label: 'PLATINUM', color: '#dfe7ef' },
  gold: { label: 'GOLD', color: '#cfb53b' },
  silver: { label: 'SILVER', color: '#b8bcc2' },
  bronze: { label: 'BRONZE', color: '#cd7f32' },
  borked: { label: 'BORKED', color: '#c0392b' },
}

export function DeckBadge({ tier }: { tier?: string | null }) {
  const t = tier ? TIERS[tier] : undefined
  if (!t) return null
  return (
    <span title={`ProtonDB / Steam Deck: ${tier}`}
      style={{ fontSize: 8, fontWeight: 'bold', letterSpacing: 0.4, color: t.color,
        border: `1px solid ${t.color}55`, borderRadius: 2, padding: '0 3px', flex: 'none', whiteSpace: 'nowrap' }}>
      ▤ {t.label}
    </span>
  )
}
