import { describe, it, expect } from 'vitest'
import { formatOwners } from '@/lib/format'

describe('formatOwners', () => {
  it('compacts a SteamSpy owners range', () => {
    expect(formatOwners('100,000,000 .. 200,000,000')).toBe('100M–200M')
    expect(formatOwners('1,000,000 .. 2,000,000')).toBe('1M–2M')
    expect(formatOwners('20,000 .. 50,000')).toBe('20K–50K')
    expect(formatOwners('1,500,000 .. 2,000,000')).toBe('1.5M–2M')
  })
  it('returns null for missing or zero estimates', () => {
    expect(formatOwners(null)).toBeNull()
    expect(formatOwners('0 .. 0')).toBeNull()
    expect(formatOwners('')).toBeNull()
  })
})
