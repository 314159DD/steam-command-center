import { describe, it, expect } from 'vitest'
import { storeUrl, headerImg, openCriticSearchUrl } from '@/lib/steam-urls'

describe('storeUrl', () => {
  it('builds a Steam store app URL', () => {
    expect(storeUrl(570)).toBe('https://store.steampowered.com/app/570')
  })
})

describe('headerImg', () => {
  it('prefers a stored header_image when present', () => {
    expect(headerImg(570, 'https://example/h.jpg')).toBe('https://example/h.jpg')
  })
  it('derives a CDN header image from the app id when none is stored', () => {
    expect(headerImg(570, null)).toBe('https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg')
    expect(headerImg(570, '')).toBe('https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg')
  })
})

describe('openCriticSearchUrl', () => {
  it('builds an OpenCritic search URL for a simple name', () => {
    expect(openCriticSearchUrl('Hades')).toBe('https://opencritic.com/search?q=Hades')
  })
  it('encodes spaces and special characters', () => {
    expect(openCriticSearchUrl('Tom & Jerry')).toBe('https://opencritic.com/search?q=Tom%20%26%20Jerry')
    expect(openCriticSearchUrl('Half-Life: Alyx')).toBe('https://opencritic.com/search?q=Half-Life%3A%20Alyx')
  })
})
