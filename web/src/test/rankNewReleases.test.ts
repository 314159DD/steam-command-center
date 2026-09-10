import { describe, it, expect } from 'vitest'
import { rankNewReleases, splitNewReleaseTiers } from '@/lib/filters'

const g = (over: Record<string, any>) => ({
  app_id: 0, name: 'x', tags: [], review_count: null, review_score: null,
  owners_estimate: null, opencritic: null, metacritic: null, ...over,
})

// rankNewReleases now uses a composite scorer with a quality floor (MIN_COMPOSITE).
// Zero-signal games are dropped; see filters-new-releases.test.ts for full coverage.
describe('rankNewReleases (composite scorer, quality floor)', () => {
  it('drops junk-tag games', () => {
    const out = rankNewReleases([
      g({ app_id: 1, name: 'Gem', tags: ['Roguelike'], review_count: 20, review_score: 90 }),
      g({ app_id: 2, name: 'Smut', tags: ['Hentai'], review_count: 20, review_score: 90 }),
    ])
    expect(out.map((x) => x.app_id)).toEqual([1])
  })

  it('drops bad-reviewed games (enough reviews to judge, score too low)', () => {
    const out = rankNewReleases([
      g({ app_id: 1, name: 'Good', tags: ['RPG'], review_count: 20, review_score: 88 }),
      g({ app_id: 2, name: 'Bad', tags: ['RPG'], review_count: 20, review_score: 40 }),
    ])
    expect(out.map((x) => x.app_id)).toEqual([1])
  })

  it('keeps a game with strong review signal (>=10 reviews AND >=65 score)', () => {
    const out = rankNewReleases([
      g({ app_id: 1, name: 'Reviewed', tags: ['RPG'], review_count: 12, review_score: 78 }),
    ])
    expect(out.map((x) => x.app_id)).toEqual([1])
  })

  it('keeps strong-signal games and ranks them best-first by composite score', () => {
    const out = rankNewReleases([
      // strong review signal
      g({ app_id: 2, name: 'Zebra', tags: ['RPG'], review_count: 80, review_score: 90 }),
      // critic score present
      g({ app_id: 4, name: 'Yak', tags: ['RPG'], review_count: 2, review_score: null, opencritic: 85 }),
    ])
    const ids = out.map((x) => x.app_id).sort()
    expect(ids).toEqual([2, 4])
  })

  it('ranks signaled survivors by score weighted by review-count confidence', () => {
    const out = rankNewReleases([
      g({ app_id: 1, name: 'Thin', tags: ['RPG'], review_count: 12, review_score: 90 }),
      g({ app_id: 2, name: 'Proven', tags: ['RPG'], review_count: 80, review_score: 90 }),
    ])
    expect(out.map((x) => x.app_id)).toEqual([2, 1])
  })

  it('ranks a strong well-reviewed game above a critic-only thin game', () => {
    const out = rankNewReleases([
      g({ app_id: 1, name: 'CriticOnly', tags: ['RPG'], review_count: 2, review_score: null, opencritic: 60 }),
      g({ app_id: 2, name: 'Strong', tags: ['RPG'], review_count: 60, review_score: 92 }),
    ])
    expect(out[0].app_id).toBe(2)
  })
})

describe('splitNewReleaseTiers', () => {
  it('drops a junk-tagged game from BOTH tiers', () => {
    const { proven, promising } = splitNewReleaseTiers([
      g({ app_id: 1, name: 'Smut', tags: ['Hentai'], review_count: 20, review_score: 90 }),
    ])
    expect(proven.map((x) => x.app_id)).toEqual([])
    expect(promising.map((x) => x.app_id)).toEqual([])
  })

  it('drops a confidently-bad game from BOTH tiers', () => {
    const { proven, promising } = splitNewReleaseTiers([
      g({ app_id: 1, name: 'Bad', tags: ['RPG'], review_count: 30, review_score: 40 }),
    ])
    expect(proven.map((x) => x.app_id)).toEqual([])
    expect(promising.map((x) => x.app_id)).toEqual([])
  })

  it('puts a strong-signal game in proven and a no-signal game in promising', () => {
    const { proven, promising } = splitNewReleaseTiers([
      g({ app_id: 1, name: 'Strong', tags: ['RPG'], review_count: 40, review_score: 90 }),
      g({ app_id: 2, name: 'Promising', tags: ['RPG'], review_count: 0, review_score: null, owners_estimate: '0 .. 20,000' }),
    ])
    expect(proven.map((x) => x.app_id)).toEqual([1])
    expect(promising.map((x) => x.app_id)).toEqual([2])
  })

  it('sorts each tier independently best-first by newReleaseScore', () => {
    const { proven, promising } = splitNewReleaseTiers([
      // two proven, lower-score listed first to prove sorting
      g({ app_id: 1, name: 'ProvenThin', tags: ['RPG'], review_count: 12, review_score: 90 }),
      g({ app_id: 2, name: 'ProvenDeep', tags: ['RPG'], review_count: 80, review_score: 90 }),
      // two promising
      g({ app_id: 3, name: 'PromiseLow', tags: ['RPG'], review_count: null, review_score: null }),
      g({ app_id: 4, name: 'PromiseFew', tags: ['RPG'], review_count: 2, review_score: null }),
    ])
    expect(proven.map((x) => x.app_id)).toEqual([2, 1])
    // both promising score 0 → stable tiebreak by name (PromiseFew < PromiseLow)
    expect(promising.map((x) => x.app_id)).toEqual([4, 3])
  })
})
