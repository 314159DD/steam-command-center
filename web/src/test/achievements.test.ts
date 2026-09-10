import { describe, it, expect } from 'vitest'
import { summarizeAchievements, mergeFullAchievements } from '@/lib/achievements'

describe('mergeFullAchievements', () => {
  it('merges player+schema+global, unlocked-rarest first then locked, picks the right icon', () => {
    const player = [{ apiname: 'A', achieved: 1, unlocktime: 0, name: 'a' }, { apiname: 'B', achieved: 0, unlocktime: 0, name: 'b' }, { apiname: 'C', achieved: 1, unlocktime: 0, name: 'c' }]
    const schema = [{ apiname: 'A', name: 'Alpha', icon: 'ia', icongray: 'iag' }, { apiname: 'B', name: 'Beta', icon: 'ib', icongray: 'ibg' }, { apiname: 'C', name: 'Gamma', icon: 'ic', icongray: 'icg' }]
    const global = new Map([['A', 50], ['B', 80], ['C', 5]])
    const out = mergeFullAchievements(player as any, schema as any, global)
    expect(out.map((x) => x.apiname)).toEqual(['C', 'A', 'B']) // unlocked rarest first (C 5%, A 50%), then locked B
    expect(out[0]).toMatchObject({ name: 'Gamma', achieved: 1, icon: 'ic', global_pct: 5 })
    expect(out[2]).toMatchObject({ apiname: 'B', achieved: 0, icon: 'ibg' }) // locked -> gray icon
  })
  it('returns [] when the player has no achievements for the game', () => {
    expect(mergeFullAchievements([], [{ apiname: 'A', name: 'x', icon: 'i', icongray: 'g' }] as any, new Map())).toEqual([])
  })
})

describe('summarizeAchievements', () => {
  it('computes completion + rarest unlocked from player achievements + global %', () => {
    const achs = [
      { apiname: 'A', achieved: 1, unlocktime: 100, name: 'First' },
      { apiname: 'B', achieved: 1, unlocktime: 200, name: 'Rare' },
      { apiname: 'C', achieved: 0, unlocktime: 0, name: 'Locked' },
    ]
    const gp = new Map([['A', 50], ['B', 2], ['C', 80]])
    expect(summarizeAchievements(achs, gp)).toEqual({
      achieved: 2, total: 3, pct: 67, last_unlock: 200, rarest_name: 'Rare', rarest_pct: 2,
    })
  })

  it('returns null when the game has no achievements', () => {
    expect(summarizeAchievements([], new Map())).toBeNull()
  })

  it('handles no global data and no unlocks', () => {
    const achs = [{ apiname: 'A', achieved: 0, unlocktime: 0, name: 'X' }]
    expect(summarizeAchievements(achs, new Map())).toEqual({
      achieved: 0, total: 1, pct: 0, last_unlock: null, rarest_name: null, rarest_pct: null,
    })
  })
})
