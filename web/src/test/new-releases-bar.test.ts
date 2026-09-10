import { describe, it, expect } from 'vitest'
import { isHyped, tailNote } from '@/components/NewReleasesSpotlight'

describe('NewReleasesSpotlight helpers', () => {
  it('flags high IGDB anticipation as hyped', () => {
    expect(isHyped({ igdb_hypes: 500 } as any)).toBe(true)
    expect(isHyped({ igdb_hypes: 10 } as any)).toBe(false)
    expect(isHyped({} as any)).toBe(false)
  })

  it('returns a tail note only for a thin (non-empty, under target) result', () => {
    expect(tailNote(0, 12)).toBeNull()
    expect(tailNote(12, 12)).toBeNull()
    expect(tailNote(4, 12)).toMatch(/worth flagging/i)
  })
})
