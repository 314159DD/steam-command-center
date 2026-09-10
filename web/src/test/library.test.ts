import { describe, it, expect } from 'vitest'
import { sortLibrary, filterByKind, type LibraryRow } from '@/lib/library'

const rows: LibraryRow[] = [
  { app_id: 1, name: 'Celeste', kind: 'owned', playtime_forever: 600, proton_tier: 'gold', review_score: 95, itad_price_cents: 1999, ach_pct: 40 },
  { app_id: 2, name: 'Apex', kind: 'owned', playtime_forever: 12000, proton_tier: 'platinum', review_score: 80, itad_price_cents: 0, ach_pct: 10 },
  { app_id: 3, name: 'Zelda', kind: 'wishlist', playtime_forever: 0, proton_tier: 'silver', review_score: 99, itad_price_cents: 5999, ach_pct: null },
  { app_id: 4, name: 'Borked Game', kind: 'wishlist', playtime_forever: null, proton_tier: 'borked', review_score: null, itad_price_cents: null, ach_pct: null },
  { app_id: 5, name: 'Mystery', kind: 'owned', playtime_forever: null, proton_tier: null, review_score: null, itad_price_cents: null, ach_pct: 100 },
]

describe('filterByKind', () => {
  it('all returns everything', () => {
    expect(filterByKind(rows, 'all').map((r) => r.app_id)).toEqual([1, 2, 3, 4, 5])
  })
  it('owned returns only owned', () => {
    expect(filterByKind(rows, 'owned').map((r) => r.app_id).sort()).toEqual([1, 2, 5])
  })
  it('wishlist returns only wishlist', () => {
    expect(filterByKind(rows, 'wishlist').map((r) => r.app_id).sort()).toEqual([3, 4])
  })
  it('does not mutate the input', () => {
    const copy = [...rows]
    filterByKind(rows, 'owned')
    expect(rows).toEqual(copy)
  })
})

describe('sortLibrary', () => {
  it('does not mutate the input', () => {
    const copy = JSON.stringify(rows)
    sortLibrary(rows, 'hours')
    expect(JSON.stringify(rows)).toBe(copy)
  })

  it('name sorts A-Z', () => {
    expect(sortLibrary(rows, 'name').map((r) => r.name)).toEqual(['Apex', 'Borked Game', 'Celeste', 'Mystery', 'Zelda'])
  })

  it('hours sorts desc, nulls last', () => {
    const out = sortLibrary(rows, 'hours').map((r) => r.app_id)
    expect(out[0]).toBe(2) // 12000
    expect(out[1]).toBe(1) // 600
    expect(out[2]).toBe(3) // 0
    // 4 and 5 (null playtime) sort to the bottom
    expect(out.slice(3).sort()).toEqual([4, 5])
  })

  it('completion sorts by ach_pct desc, nulls last', () => {
    const out = sortLibrary(rows, 'completion').map((r) => r.app_id)
    expect(out[0]).toBe(5) // 100
    expect(out[1]).toBe(1) // 40
    expect(out[2]).toBe(2) // 10
    expect(out.slice(3).sort()).toEqual([3, 4]) // null ach
  })

  it('deck sorts best tier first, null/pending last', () => {
    const out = sortLibrary(rows, 'deck').map((r) => r.app_id)
    expect(out[0]).toBe(2) // platinum
    expect(out[1]).toBe(1) // gold
    expect(out[2]).toBe(3) // silver
    expect(out[3]).toBe(4) // borked
    expect(out[4]).toBe(5) // null tier last
  })

  it('review sorts desc, nulls last', () => {
    const out = sortLibrary(rows, 'review').map((r) => r.app_id)
    expect(out[0]).toBe(3) // 99
    expect(out[1]).toBe(1) // 95
    expect(out[2]).toBe(2) // 80
    expect(out.slice(3).sort()).toEqual([4, 5]) // null review
  })

  it('price sorts cheapest first, nulls last (free=0 first)', () => {
    const out = sortLibrary(rows, 'price').map((r) => r.app_id)
    expect(out[0]).toBe(2) // 0 (free)
    expect(out[1]).toBe(1) // 1999
    expect(out[2]).toBe(3) // 5999
    expect(out.slice(3).sort()).toEqual([4, 5]) // null price
  })

  it('is stable for equal keys', () => {
    const equal: LibraryRow[] = [
      { app_id: 10, name: 'A', kind: 'owned', playtime_forever: 100 },
      { app_id: 11, name: 'B', kind: 'owned', playtime_forever: 100 },
      { app_id: 12, name: 'C', kind: 'owned', playtime_forever: 100 },
    ]
    expect(sortLibrary(equal, 'hours').map((r) => r.app_id)).toEqual([10, 11, 12])
  })

  it('never crashes on empty', () => {
    expect(sortLibrary([], 'hours')).toEqual([])
    expect(filterByKind([], 'all')).toEqual([])
  })
})
