import { describe, it, expect } from 'vitest'
import { applyDiscoveryFilters, type Toggles } from '@/lib/filters'

const games = [
  { app_id: 1, name: 'Gem', tags: ['Roguelike'], review_count: 500, review_score: 90 },
  { app_id: 2, name: 'Asset Flip', tags: ['Roguelike'], review_count: 3, review_score: 40 },
  { app_id: 3, name: 'FarmThing', tags: ['Farming Sim'], review_count: 800, review_score: 85 },
]
const weights = { Roguelike: 1, 'Farming Sim': 0.1 }

const ON: Toggles = { quality: true, taste: true, my_games: true, global: false }

describe('applyDiscoveryFilters', () => {
  it('quality filter drops low-review junk', () => {
    const out = applyDiscoveryFilters(games as any, weights, { ...ON, taste: false })
    expect(out.map((g) => g.app_id)).not.toContain(2)
  })

  it('taste ranks matching tags higher', () => {
    const out = applyDiscoveryFilters(games as any, weights, ON)
    expect(out[0].app_id).toBe(1) // Roguelike outranks Farming Sim
  })

  it('all filters off returns everything, unranked (original order)', () => {
    const out = applyDiscoveryFilters(games as any, weights,
      { quality: false, taste: false, my_games: false, global: false })
    expect(out.map((g) => g.app_id)).toEqual([1, 2, 3])
  })

  it('newReleases option keeps low-review games (new games have few reviews) but still drops junk tags', () => {
    const newGames = [
      { app_id: 10, name: 'Fresh Indie', tags: ['Roguelike'], review_count: 2, review_score: 0 },
      { app_id: 11, name: 'Smut', tags: ['Hentai'], review_count: 1, review_score: 0 },
    ]
    const out = applyDiscoveryFilters(newGames as any, weights, { ...ON, taste: false }, { newReleases: true })
    expect(out.map((g) => g.app_id)).toContain(10) // low reviews allowed
    expect(out.map((g) => g.app_id)).not.toContain(11) // junk tag still filtered
  })
})
