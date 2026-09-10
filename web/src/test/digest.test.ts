import { describe, it, expect } from 'vitest'
import { buildDigest, splitDigest, chunk } from '@/lib/digest'

describe('buildDigest', () => {
  it('gates signals by ownership: price for wishlist, patches/achievements for owned', () => {
    const rows = [
      // owned: near-100% + recent major patch → re-engage / finish
      { app_id: 1, name: 'A', kind: 'owned', itad_price_cents: 500, itad_atl_cents: 500, itad_cut: 75, achieved: 48, total: 50, recent_major: '2026-06-14T00:00:00Z' },
      // wishlist at all-time-low → buy signal
      { app_id: 2, name: 'B', kind: 'wishlist', itad_price_cents: 300, itad_atl_cents: 400, itad_cut: 25, achieved: 0, total: 0, recent_major: null },
      // owned, at ATL price but nothing else → excluded (price is irrelevant for games you own)
      { app_id: 3, name: 'C', kind: 'owned', itad_price_cents: 200, itad_atl_cents: 200, itad_cut: 0, achieved: 0, total: 0, recent_major: null },
    ]
    const d = buildDigest(rows)
    expect(d.map((x) => x.app_id)).toEqual([1, 2]) // 3 excluded; 1 (two signals) outranks 2
    expect(d[0].reasons.map((r) => r.type).sort()).toEqual(['ach', 'patch'])
    expect(d[1].reasons.map((r) => r.type)).toEqual(['atl'])
  })

  it('does not surface owned all-time-low or wishlist patches (wrong audience)', () => {
    const d = buildDigest([
      { app_id: 5, name: 'Owned ATL', kind: 'owned', itad_price_cents: 100, itad_atl_cents: 100, achieved: 0, total: 0, recent_major: null },
      { app_id: 6, name: 'Wishlist patched', kind: 'wishlist', itad_price_cents: 5000, itad_atl_cents: 1000, achieved: 0, total: 0, recent_major: '2026-06-14T00:00:00Z' },
    ])
    expect(d).toEqual([])
  })

  it('flags a wishlist game available on a subscription (don\'t buy)', () => {
    const d = buildDigest([{ app_id: 7, name: 'GP', kind: 'wishlist', itad_price_cents: 4000, itad_atl_cents: 1000, sub_names: ['Game Pass'], achieved: 0, total: 0, recent_major: null }])
    expect(d[0].reasons.map((r) => r.type)).toEqual(['sub'])
    expect(d[0].reasons[0].label).toContain('Game Pass')
  })

  it('flags a wishlist game currently in a bundle', () => {
    const d = buildDigest([{ app_id: 10, name: 'B', kind: 'wishlist', itad_price_cents: 4000, itad_atl_cents: 1000, bundle_count: 1, bundle_name: 'Humble: Indie Pack', achieved: 0, total: 0, recent_major: null }])
    expect(d[0].reasons.map((r) => r.type)).toEqual(['bundle'])
    expect(d[0].reasons[0].label).toContain('Humble')
  })

  it('flags an owned game with a player-count spike', () => {
    const d = buildDigest([{ app_id: 8, name: 'Spike', kind: 'owned', cur_players: 9000, prev_players: 3000, achieved: 0, total: 0, recent_major: null }])
    expect(d[0].reasons.map((r) => r.type)).toEqual(['spike'])
  })

  it('returns [] when nothing is actionable', () => {
    expect(buildDigest([{ app_id: 1, name: 'A', kind: 'owned', itad_price_cents: 2000, itad_atl_cents: 500, achieved: 0, total: 0, recent_major: null }])).toEqual([])
  })
})

describe('splitDigest', () => {
  it('splits into the first n visible and the rest', () => {
    const items = [1, 2, 3, 4, 5]
    expect(splitDigest(items, 3)).toEqual({ visible: [1, 2, 3], rest: [4, 5] })
  })

  it('rest is empty when the list fits within n', () => {
    expect(splitDigest([1, 2], 12)).toEqual({ visible: [1, 2], rest: [] })
  })

  it('handles an empty list', () => {
    expect(splitDigest([], 12)).toEqual({ visible: [], rest: [] })
  })
})

describe('chunk', () => {
  it('splits into consecutive pages of size n (last may be shorter)', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('produces exact full pages when divisible', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('one page when the list fits within n', () => {
    expect(chunk([1, 2, 3], 12)).toEqual([[1, 2, 3]])
  })

  it('empty list -> no pages', () => {
    expect(chunk([], 12)).toEqual([])
  })
})
