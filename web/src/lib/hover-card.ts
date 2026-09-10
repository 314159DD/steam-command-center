export function microtrailerUrl(movieId: number): string {
  return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${movieId}/microtrailer.webm`
}

export function compactCount(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + ' M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + ' K'
  return String(n)
}

export function groupedCount(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatCardPrice(
  priceCents?: number | null, atlCents?: number | null, cut?: number | null,
): string | null {
  if (priceCents == null) return null
  const eur = (c: number) => '€' + (c / 100).toFixed(2)
  let s = priceCents === 0 ? 'Free' : eur(priceCents)
  if (atlCents != null && atlCents !== priceCents) s += ' · ATL ' + eur(atlCents)
  if (cut != null && cut > 0) s += ` -${cut}%`
  return s
}

// Prefer the live player count (player_counts); fall back to SteamSpy's ccu only
// when it's positive (it's 0 for ~half the catalog SteamSpy hasn't indexed).
// Returns null when neither source has a real value, so the card hides the line
// instead of rendering a misleading "0".
export function displayPlayerCount(live?: number | null, spyCcu?: number | null): number | null {
  if (live != null && live > 0) return live
  if (spyCcu != null && spyCcu > 0) return spyCcu
  return null
}

type Rect = { top: number; bottom: number; left: number; right: number; width: number; height: number }
type Size = { width: number; height: number }

export function hoverCardPosition(anchor: Rect, card: Size, viewport: Size):
    { top: number; left: number; placement: 'right' | 'left' } {
  const GAP = 8
  let placement: 'right' | 'left' = 'right'
  let left = anchor.right + GAP
  const noRoomRight = left + card.width > viewport.width
  const roomLeft = anchor.left - GAP - card.width >= 0
  if (noRoomRight && roomLeft) {
    placement = 'left'
    left = anchor.left - GAP - card.width
  }
  // last-resort horizontal clamp (e.g. neither side has room in a narrow viewport)
  if (left + card.width > viewport.width) left = viewport.width - card.width - GAP
  if (left < GAP) left = GAP
  // vertical: align to the anchor's top, clamp into the viewport
  let top = anchor.top
  if (top + card.height > viewport.height) top = viewport.height - card.height - GAP
  if (top < GAP) top = GAP
  return { top, left, placement }
}
