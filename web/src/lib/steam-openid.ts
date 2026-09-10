const STEAM_OPENID = 'https://steamcommunity.com/openid/login'
const NS = 'http://specs.openid.net/auth/2.0'
const IDENTIFIER = 'http://specs.openid.net/auth/2.0/identifier_select'

export function buildLoginUrl(returnTo: string): string {
  const p = new URLSearchParams({
    'openid.ns': NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': new URL(returnTo).origin,
    'openid.identity': IDENTIFIER,
    'openid.claimed_id': IDENTIFIER,
  })
  return `${STEAM_OPENID}?${p.toString()}`
}

export function extractSteamId(claimedId: string | null): string | null {
  if (!claimedId) return null
  const m = claimedId.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/)
  return m ? m[1] : null
}

/** Verify the assertion by echoing params back with mode=check_authentication. */
export async function verifyAssertion(params: URLSearchParams): Promise<boolean> {
  const body = new URLSearchParams(params)
  body.set('openid.mode', 'check_authentication')
  const res = await fetch(STEAM_OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const text = await res.text()
  return /is_valid\s*:\s*true/.test(text)
}
