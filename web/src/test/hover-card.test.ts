import { describe, it, expect } from 'vitest'
import { microtrailerUrl, compactCount, groupedCount, formatCardPrice, displayPlayerCount, hoverCardPosition } from '@/lib/hover-card'

describe('hover-card helpers', () => {
  it('builds the steam microtrailer url from a movie id', () => {
    expect(microtrailerUrl(256972298)).toBe(
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/256972298/microtrailer.webm')
  })

  it('compactCount abbreviates millions/thousands', () => {
    expect(compactCount(4_830_000)).toBe('4.83 M')
    expect(compactCount(12_300)).toBe('12.3 K')
    expect(compactCount(4_000_000)).toBe('4 M')
    expect(compactCount(500)).toBe('500')
  })

  it('groupedCount adds thousands separators', () => {
    expect(groupedCount(1_362_617)).toBe('1,362,617')
  })

  describe('formatCardPrice', () => {
    it('returns null when there is no price', () => {
      expect(formatCardPrice(null)).toBeNull()
      expect(formatCardPrice(undefined)).toBeNull()
    })
    it('formats a plain price', () => {
      expect(formatCardPrice(1499)).toBe('€14.99')
    })
    it('shows Free for zero', () => {
      expect(formatCardPrice(0)).toBe('Free')
    })
    it('appends ATL when it differs from the price', () => {
      expect(formatCardPrice(1499, 449)).toBe('€14.99 · ATL €4.49')
    })
    it('omits ATL when it equals the price', () => {
      expect(formatCardPrice(449, 449)).toBe('€4.49')
    })
    it('appends the cut percentage when on sale', () => {
      expect(formatCardPrice(1499, 449, 70)).toBe('€14.99 · ATL €4.49 -70%')
    })
  })

  describe('displayPlayerCount', () => {
    it('prefers the live count when it is positive', () => {
      expect(displayPlayerCount(21759, 0)).toBe(21759)
      expect(displayPlayerCount(21759, 500)).toBe(21759)
    })
    it('falls back to spy_ccu only when live is absent and spy is positive', () => {
      expect(displayPlayerCount(null, 500)).toBe(500)
      expect(displayPlayerCount(undefined, 500)).toBe(500)
      expect(displayPlayerCount(0, 500)).toBe(500)
    })
    it('returns null when neither source has a positive value', () => {
      expect(displayPlayerCount(0, 0)).toBeNull()
      expect(displayPlayerCount(null, null)).toBeNull()
      expect(displayPlayerCount(undefined, undefined)).toBeNull()
    })
  })

  describe('hoverCardPosition', () => {
    const vp = { width: 1000, height: 600 }
    const card = { width: 270, height: 360 }

    it('anchors to the right of the item by default', () => {
      const anchor = { top: 100, bottom: 120, left: 100, right: 180, width: 80, height: 20 }
      const p = hoverCardPosition(anchor, card, vp)
      expect(p.placement).toBe('right')
      expect(p.left).toBe(188)   // anchor.right + 8
      expect(p.top).toBe(100)    // anchor.top
    })

    it('flips to the left when there is no room on the right', () => {
      const anchor = { top: 100, bottom: 120, left: 900, right: 980, width: 80, height: 20 }
      const p = hoverCardPosition(anchor, card, vp)
      expect(p.placement).toBe('left')
      expect(p.left).toBe(622)   // anchor.left - 8 - 270
    })

    it('clamps vertically near the bottom', () => {
      const anchor = { top: 560, bottom: 580, left: 100, right: 180, width: 80, height: 20 }
      const p = hoverCardPosition(anchor, card, vp)
      expect(p.top + card.height).toBeLessThanOrEqual(vp.height)
    })

    it('clamps vertically near the top', () => {
      const anchor = { top: 2, bottom: 22, left: 100, right: 180, width: 80, height: 20 }
      const p = hoverCardPosition(anchor, card, vp)
      expect(p.top).toBe(8)
    })

    it('stays right and clamps horizontally when neither side has room', () => {
      const narrow = { width: 300, height: 600 }
      const anchor = { top: 100, bottom: 120, left: 20, right: 280, width: 260, height: 20 }
      const p = hoverCardPosition(anchor, card, narrow)
      expect(p.placement).toBe('right')
      expect(p.left + card.width).toBeLessThanOrEqual(narrow.width)
      expect(p.left).toBeGreaterThanOrEqual(8)
    })
  })
})
