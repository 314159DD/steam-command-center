import { describe, it, expect } from 'vitest'
import { rankBacklog } from '@/lib/backlog'

describe('rankBacklog', () => {
  it('keeps barely-played, Deck-ready games ranked by best score', () => {
    const rows = [
      { app_id: 1, name: 'A', playtime_forever: 30, proton_tier: 'gold', review_score: 80, opencritic: 90, metacritic: 85 },
      { app_id: 2, name: 'B', playtime_forever: 5, proton_tier: 'platinum', review_score: 95, opencritic: null, metacritic: null },
      { app_id: 3, name: 'C', playtime_forever: 500, proton_tier: 'gold', review_score: 99 }, // played too much
      { app_id: 4, name: 'D', playtime_forever: 0, proton_tier: 'borked', review_score: 99 }, // won't run on Deck
      { app_id: 5, name: 'E', playtime_forever: 0, proton_tier: 'silver', review_score: 50 }, // silver excluded
    ]
    const out = rankBacklog(rows)
    expect(out.map((r) => r.app_id)).toEqual([2, 1]) // 95 then 90; 3/4/5 excluded
    expect(out[0].best_score).toBe(95)
    expect(out[1].best_score).toBe(90) // from opencritic
  })

  it('returns [] when nothing qualifies', () => {
    expect(rankBacklog([{ app_id: 9, name: 'Z', playtime_forever: 1000, proton_tier: 'gold', review_score: 90 }])).toEqual([])
  })
})
