import { NextRequest, NextResponse } from 'next/server'
import { extractSteamId, verifyAssertion } from '@/lib/steam-openid'
import { setSession } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const ok = await verifyAssertion(params)
  const steamId = extractSteamId(params.get('openid.claimed_id'))
  if (!ok || !steamId) {
    return NextResponse.redirect(`${process.env.APP_BASE_URL}/?login=failed`)
  }
  await db()`
    insert into users (steam_id, last_login) values (${steamId}, now())
    on conflict (steam_id) do update set last_login = now()`
  await setSession(steamId)
  return NextResponse.redirect(`${process.env.APP_BASE_URL}/?login=ok`)
}
