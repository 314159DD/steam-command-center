import { GameThumb } from './GameThumb'
import { HoverLink } from './HoverPreview'

const euro = (c: number) => `€${(c / 100).toFixed(2)}`

type Drop = {
  app_id: number; name: string; header_image: string | null
  old_cents: number | null; new_cents: number | null; at_atl: boolean
}

export function PriceDrops({ drops }: { drops: Drop[] }) {
  if (drops.length === 0) return null
  return (
    <>
      <div className="barhead" style={{ marginTop: 4 }}>⬇ Price Drops · Your Wishlist</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, padding: '10px 18px 6px' }}>
        {drops.map((d) => (
          <HoverLink key={d.app_id} appId={d.app_id} href={`/game/${d.app_id}`}
             style={{ display: 'flex', gap: 10, padding: 8, background: 'var(--panel2)', border: `1px solid ${d.at_atl ? '#6f5e36' : '#2a2d22'}`, borderRadius: 3, textDecoration: 'none', color: 'inherit', alignItems: 'center' }}>
            <GameThumb appId={d.app_id} stored={d.header_image} name={d.name} w={72} h={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'bold', color: '#e7e9da', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>
                {d.old_cents != null && <span style={{ color: 'var(--dim)', textDecoration: 'line-through', marginRight: 5 }}>{euro(d.old_cents)}</span>}
                {d.new_cents != null && <b style={{ color: d.at_atl ? 'var(--yellow)' : 'var(--gold)' }}>{euro(d.new_cents)}</b>}
                {d.at_atl && <span style={{ color: 'var(--yellow)', marginLeft: 5 }}>all-time low!</span>}
              </div>
            </div>
          </HoverLink>
        ))}
      </div>
    </>
  )
}
