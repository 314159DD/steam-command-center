import { describe, it, expect } from 'vitest'
import { deriveTagWeights, tasteScore } from '@/lib/taste'

const lib = [
  { app_id: 1, playtime_forever: 1000 },  // heavy
  { app_id: 2, playtime_forever: 0 },     // owned but unplayed
]
const games = [
  { app_id: 1, tags: ['Roguelike', 'Action'] },
  { app_id: 2, tags: ['Farming Sim'] },
]

describe('deriveTagWeights', () => {
  it('weights tags by playtime (log-damped) and normalizes to 0..1', () => {
    const w = deriveTagWeights(lib as any, games as any)
    expect(w['Roguelike']).toBeGreaterThan(w['Farming Sim'])
    expect(Math.max(...Object.values(w))).toBeCloseTo(1, 5)
  })

  it('still gives unplayed-but-owned tags a small positive weight', () => {
    const w = deriveTagWeights(lib as any, games as any)
    expect(w['Farming Sim']).toBeGreaterThan(0)
  })
})

describe('tasteScore', () => {
  it('scores a game by summing its tag weights', () => {
    const w = { Roguelike: 1, Action: 0.5 }
    expect(tasteScore(['Roguelike', 'Action'], w)).toBeCloseTo(1.5)
    expect(tasteScore(['Unknown'], w)).toBe(0)
  })
})
