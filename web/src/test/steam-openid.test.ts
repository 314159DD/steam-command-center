import { describe, it, expect } from 'vitest'
import { buildLoginUrl, extractSteamId } from '@/lib/steam-openid'

describe('steam-openid', () => {
  it('builds a Steam OpenID redirect with our return_to', () => {
    const url = new URL(buildLoginUrl('http://localhost:3000/api/auth/callback'))
    expect(url.origin + url.pathname).toBe('https://steamcommunity.com/openid/login')
    expect(url.searchParams.get('openid.mode')).toBe('checkid_setup')
    expect(url.searchParams.get('openid.return_to')).toBe('http://localhost:3000/api/auth/callback')
  })

  it('extracts the 17-digit steamid from a claimed_id', () => {
    const id = extractSteamId('https://steamcommunity.com/openid/id/76561197960287930')
    expect(id).toBe('76561197960287930')
  })

  it('returns null for a malformed claimed_id', () => {
    expect(extractSteamId('https://example.com/not-steam')).toBeNull()
  })
})
