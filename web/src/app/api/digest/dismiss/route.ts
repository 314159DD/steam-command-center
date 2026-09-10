import { NextRequest, NextResponse } from 'next/server'
import { getSteamId } from '@/lib/session'
import { dismissDigest } from '@/lib/queries'

export async function POST(req: NextRequest) {
  const steamId = await getSteamId()
  if (!steamId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  const { app_id } = await req.json()
  if (typeof app_id !== 'number') return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  await dismissDigest(steamId, app_id)
  return NextResponse.json({ ok: true })
}
