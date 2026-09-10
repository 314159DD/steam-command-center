import { describe, it, expect } from 'vitest'
import { newReleaseScore, rankNewReleases, type NewReleaseGame } from '@/lib/filters'

const base: NewReleaseGame = {
  app_id: 1, name: 'A', tags: [], review_count: null, review_score: null,
}

describe('newReleaseScore composite', () => {
  it('rewards a strong critic score', () => {
    const g = { ...base, igdb_aggregated_rating: 90, igdb_rating_count: 20 }
    expect(newReleaseScore(g, {})).toBeGreaterThan(newReleaseScore(base, {}))
  })

  it('rewards player reviews scaled by confidence', () => {
    const few = { ...base, app_id: 2, review_score: 95, review_count: 3 }
    const many = { ...base, app_id: 3, review_score: 95, review_count: 200 }
    expect(newReleaseScore(many, {})).toBeGreaterThan(newReleaseScore(few, {}))
  })

  it('rewards IGDB hype/follows (buzz)', () => {
    const hyped = { ...base, igdb_hypes: 2000, igdb_follows: 20000 }
    expect(newReleaseScore(hyped, {})).toBeGreaterThan(newReleaseScore(base, {}))
  })

  it('applies a taste multiplier for owned-genre tags', () => {
    const g = { ...base, tags: ['Roguelike'], igdb_aggregated_rating: 80 }
    const withTaste = newReleaseScore(g, { Roguelike: 1 })
    const without = newReleaseScore(g, {})
    expect(withTaste).toBeGreaterThan(without)
  })
})

describe('rankNewReleases floor + ordering', () => {
  it('drops junk-tag games entirely', () => {
    const junk = { ...base, app_id: 9, tags: ['Hentai'], igdb_aggregated_rating: 99 }
    expect(rankNewReleases([junk], {}).find((g) => g.app_id === 9)).toBeUndefined()
  })

  it('drops confidently-bad games (enough reviews, low score)', () => {
    const bad = { ...base, app_id: 8, review_score: 40, review_count: 50 }
    expect(rankNewReleases([bad], {}).find((g) => g.app_id === 8)).toBeUndefined()
  })

  it('drops zero-signal games below the composite floor (no padding)', () => {
    const nothing = { ...base, app_id: 7 }
    expect(rankNewReleases([nothing], {})).toEqual([])
  })

  it('keeps a strong-signal game and orders best-first', () => {
    const great = { ...base, app_id: 5, name: 'Great', igdb_aggregated_rating: 92, igdb_rating_count: 30 }
    const okay = { ...base, app_id: 6, name: 'Okay', review_score: 80, review_count: 60 }
    const ranked = rankNewReleases([okay, great], {})
    expect(ranked.map((g) => g.app_id)).toEqual([5, 6])
  })
})
