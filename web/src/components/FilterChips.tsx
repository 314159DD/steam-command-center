'use client'
import { useState } from 'react'
import type { Toggles } from '@/lib/filters'

// Only quality + taste are wired into applyDiscoveryFilters; my_games/global were
// never read, so they're not shown (they looked broken because they did nothing).
const LABELS: { key: keyof Toggles; label: string }[] = [
  { key: 'quality', label: 'Quality filter' },
  { key: 'taste', label: 'Taste match' },
]

export function FilterChips({ initial }: { initial: Toggles }) {
  const [toggles, setToggles] = useState(initial)
  function flip(key: keyof Toggles) {
    const next = { ...toggles, [key]: !toggles[key] }
    setToggles(next)
    fetch('/api/prefs', { method: 'POST', body: JSON.stringify(next) })
      .then(() => location.reload())
  }
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {LABELS.map(({ key, label }) => (
        <span key={key} className={`chip ${toggles[key] ? 'on' : ''}`} onClick={() => flip(key)}>{label}</span>
      ))}
    </div>
  )
}
