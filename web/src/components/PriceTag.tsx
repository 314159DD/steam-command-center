function euro(c: number) { return `€${(c / 100).toFixed(2)}` }

// Best current price across stores + all-time low (ITAD). Highlights when the
// current price is at/under the historical low.
export function PriceTag({ price, atl, cut, shop }: {
  price?: number | null; atl?: number | null; cut?: number | null; shop?: string | null
}) {
  if (price == null && atl == null) return null
  const atLow = price != null && atl != null && price > 0 && price <= atl
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, flex: 'none', whiteSpace: 'nowrap' }}>
      {price != null && (
        <b title={shop ? `Best price at ${shop}` : undefined} style={{ color: atLow ? 'var(--yellow)' : 'var(--gold)' }}>
          {price === 0 ? 'Free' : euro(price)}{cut ? ` −${cut}%` : ''}
        </b>
      )}
      {atl != null && (
        <span style={{ color: atLow ? 'var(--yellow)' : 'var(--dim)' }} title="all-time low">
          {atLow ? '◀ all-time low!' : `low ${euro(atl)}`}
        </span>
      )}
    </span>
  )
}
