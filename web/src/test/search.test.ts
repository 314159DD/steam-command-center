import { describe, it, expect } from 'vitest'
import { rankSearchResults } from '@/lib/queries'

const g = (over: Record<string, any>) => ({
  app_id: 0, name: 'x', header_image: null, review_score: null, review_count: null, proton_tier: null, ...over,
})

describe('rankSearchResults', () => {
  it('returns [] for a blank term', () => {
    const rows = [g({ app_id: 1, name: 'Portal' })]
    expect(rankSearchResults(rows, '')).toEqual([])
    expect(rankSearchResults(rows, '   ')).toEqual([])
  })

  it('ranks an exact (case-insensitive) name match first', () => {
    const out = rankSearchResults([
      g({ app_id: 1, name: 'Portal Knights' }),
      g({ app_id: 2, name: 'Portal' }),
      g({ app_id: 3, name: 'The Portal Story' }),
    ], 'portal')
    expect(out[0].app_id).toBe(2)
  })

  it('ranks prefix matches above substring matches', () => {
    const out = rankSearchResults([
      g({ app_id: 1, name: 'The Stanley Parable' }), // substring
      g({ app_id: 2, name: 'Stanley Goes Home' }),   // prefix
    ], 'stanley')
    expect(out.map((x) => x.app_id)).toEqual([2, 1])
  })

  it('keeps exact > prefix > substring ordering together', () => {
    const out = rankSearchResults([
      g({ app_id: 1, name: 'A Doom-like Game' }), // substring
      g({ app_id: 2, name: 'Doom Eternal' }),     // prefix
      g({ app_id: 3, name: 'DOOM' }),             // exact (case-insensitive)
    ], 'doom')
    expect(out.map((x) => x.app_id)).toEqual([3, 2, 1])
  })

  it('uses review_count desc as a tiebreak within the same tier', () => {
    const out = rankSearchResults([
      g({ app_id: 1, name: 'Half-Life 2', review_count: 100 }),
      g({ app_id: 2, name: 'Half-Life Alyx', review_count: 5000 }),
    ], 'half-life')
    // both are prefix matches → higher review_count wins
    expect(out.map((x) => x.app_id)).toEqual([2, 1])
  })

  it('treats null review_count as 0 in the tiebreak', () => {
    const out = rankSearchResults([
      g({ app_id: 1, name: 'Celeste Classic', review_count: null }),
      g({ app_id: 2, name: 'Celeste 64', review_count: 12 }),
    ], 'celeste')
    expect(out.map((x) => x.app_id)).toEqual([2, 1])
  })

  it('trims the search term before matching', () => {
    const out = rankSearchResults([
      g({ app_id: 1, name: 'Hades II' }),
      g({ app_id: 2, name: 'Hades' }),
    ], '  hades  ')
    expect(out[0].app_id).toBe(2) // exact match after trim
  })
})
