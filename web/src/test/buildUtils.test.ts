import { describe, it, expect } from 'vitest'
import { isRecentBuild } from '../lib/buildUtils'

const now = new Date('2026-06-15T12:00:00Z')

describe('isRecentBuild', () => {
  it('returns true for 1 day ago', () => {
    const d = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    expect(isRecentBuild(d, now)).toBe(true)
  })

  it('returns false for 20 days ago', () => {
    const d = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)
    expect(isRecentBuild(d, now)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isRecentBuild(null, now)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isRecentBuild(undefined, now)).toBe(false)
  })

  it('returns true for exactly 14 days ago (inclusive boundary)', () => {
    const d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    expect(isRecentBuild(d, now)).toBe(true)
  })

  it('returns false for 15 days ago', () => {
    const d = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
    expect(isRecentBuild(d, now)).toBe(false)
  })

  // String inputs - covers the real DB path (Neon HTTP driver returns timestamptz as ISO strings)
  it('returns true for ISO string ~1 day ago', () => {
    const s = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    expect(isRecentBuild(s, now)).toBe(true)
  })

  it('returns false for ISO string ~20 days ago', () => {
    const s = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString()
    expect(isRecentBuild(s, now)).toBe(false)
  })

  it('returns false for an invalid date string', () => {
    expect(isRecentBuild('not-a-date', now)).toBe(false)
  })
})
