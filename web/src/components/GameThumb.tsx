'use client'
import { useState } from 'react'

// Established games resolve from the derived CDN paths; brand-new/obscure games
// only resolve from the URL the store API returned (passed as `stored`). We try
// all in order and fall back to a lettered placeholder so nothing renders blank.
function candidates(appId: number, stored?: string | null): string[] {
  const list: string[] = []
  if (stored) list.push(stored)
  list.push(`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`)
  list.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`)
  return list
}

export function GameThumb({ appId, stored, name, w, h }: {
  appId: number; stored?: string | null; name?: string; w: number; h: number
}) {
  const srcs = candidates(appId, stored)
  const [i, setI] = useState(0)

  if (i >= srcs.length) {
    return (
      <div className="cap" style={{ width: w, height: h, flex: 'none', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: Math.max(9, Math.round(h * 0.5)), fontWeight: 'bold', color: '#7a7e64' }}>
        {(name || '?').trim().slice(0, 1).toUpperCase()}
      </div>
    )
  }
  return (
    <img src={srcs[i]} alt="" width={w} height={h} loading="lazy" onError={() => setI(i + 1)}
      style={{ width: w, height: h, flex: 'none', objectFit: 'cover', borderRadius: 2, background: '#11130d' }} />
  )
}
