import { NextRequest, NextResponse } from 'next/server'
import { getSteamId } from '@/lib/session'
import { saveToggles } from '@/lib/queries'

export async function POST(req: NextRequest) {
  const steamId = await getSteamId()
  if (!steamId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  const toggles = await req.json()
  await saveToggles(steamId, toggles)
  return NextResponse.json({ ok: true })
}
