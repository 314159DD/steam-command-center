import { describe, it, expect } from 'vitest'
import { groupUpdatesByGame, blurb } from '@/lib/updates'

const rows = [
  { app_id: 1, game_name: 'Gothic', header_image: null, gid: 'a', classification: 'MAJOR', title: 'Patch 1.0', body: 'b', url: 'u1', posted_at: '2026-06-13T00:00:00Z', lib: { kind: 'wishlist', playtime_forever: 0 } },
  { app_id: 1, game_name: 'Gothic', header_image: null, gid: 'b', classification: 'UPDATE', title: 'Review', body: 'b', url: 'u2', posted_at: '2026-06-12T00:00:00Z', lib: { kind: 'wishlist', playtime_forever: 0 } },
  { app_id: 2, game_name: 'Dota', header_image: 'h', gid: 'c', classification: 'UPDATE', title: 'x', body: 'b', url: 'u3', posted_at: '2026-06-14T00:00:00Z', lib: { kind: 'owned', playtime_forever: 600 } },
]

describe('groupUpdatesByGame', () => {
  it('collapses updates into one group per game, newest game first', () => {
    const groups = groupUpdatesByGame(rows as any)
    expect(groups.map((g) => g.app_id)).toEqual([2, 1]) // Dota (06-14) before Gothic (06-13)
  })
  it('keeps each game\'s updates newest-first and carries game metadata', () => {
    const groups = groupUpdatesByGame(rows as any)
    const gothic = groups.find((g) => g.app_id === 1)!
    expect(gothic.name).toBe('Gothic')
    expect(gothic.lib?.kind).toBe('wishlist')
    expect(gothic.updates.map((u) => u.gid)).toEqual(['a', 'b'])
    expect(gothic.latest).toBe('2026-06-13T00:00:00Z')
  })
})

describe('blurb', () => {
  it('returns empty string for null/empty input', () => {
    expect(blurb(null)).toBe('')
    expect(blurb('')).toBe('')
  })
  it('strips residual bbcode and HTML', () => {
    expect(blurb('[b]New[/b] <i>battlegrounds</i> await')).toBe('New battlegrounds await')
  })
  it('returns short text unchanged (no ellipsis)', () => {
    const s = 'The fall of the 26th Regiment is your gain.'
    expect(blurb(s)).toBe(s)
  })
  it('truncates long text on a word boundary with an ellipsis', () => {
    const long = 'The fall of the 26th Regiment is your gain. New battlegrounds, prototype firepower and a great deal more await every single one of you brave hunters out there tonight and beyond.'
    const out = blurb(long, 60)
    expect(out.length).toBeLessThanOrEqual(61) // <= max + ellipsis char
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toContain('  ')
    expect(out.startsWith('The fall of the')).toBe(true)
  })
  it('does not leave trailing punctuation before the ellipsis', () => {
    const out = blurb('alpha beta gamma delta epsilon zeta, eta theta iota', 30)
    expect(out).not.toMatch(/[,.\s]…$/)
  })
})
