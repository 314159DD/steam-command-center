import { describe, it, expect } from 'vitest'
import { parseOwnedGames, parseStoreItems } from '@/lib/steam-web-api'

describe('parseStoreItems', () => {
  it('extracts app_id, name and the full header image url from assets', () => {
    const payload = { response: { store_items: [
      { appid: 570, name: 'Dota 2', assets: { asset_url_format: 'steam/apps/570/${FILENAME}?t=1', header: 'abc/header.jpg' } },
      { appid: 999, name: 'NoAssets' },
    ]}}
    expect(parseStoreItems(payload)).toEqual([
      { app_id: 570, name: 'Dota 2', header_image: 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/570/abc/header.jpg?t=1' },
      { app_id: 999, name: 'NoAssets', header_image: null },
    ])
  })
  it('returns [] when there are no store items', () => {
    expect(parseStoreItems({})).toEqual([])
  })
})

describe('parseOwnedGames', () => {
  it('maps owned games to library rows with playtime and name', () => {
    const payload = { response: { games: [
      { appid: 570, name: 'Dota 2', playtime_forever: 8520, playtime_2weeks: 600 },
      { appid: 730, name: 'Counter-Strike 2', playtime_forever: 100 },
    ]}}
    const rows = parseOwnedGames(payload, '76561197960287930')
    expect(rows).toEqual([
      { steam_id: '76561197960287930', app_id: 570, name: 'Dota 2', kind: 'owned', playtime_forever: 8520, playtime_2weeks: 600 },
      { steam_id: '76561197960287930', app_id: 730, name: 'Counter-Strike 2', kind: 'owned', playtime_forever: 100, playtime_2weeks: 0 },
    ])
  })

  it('returns [] when the profile is private (no games array)', () => {
    expect(parseOwnedGames({ response: {} }, 'x')).toEqual([])
  })
})
