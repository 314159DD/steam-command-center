import { NextResponse } from 'next/server'
import { getGameCard } from '@/lib/queries'
import { getSteamId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ appid: string }> }) {
  const { appid } = await ctx.params
  const appId = Number(appid)
  if (!Number.isFinite(appId)) return NextResponse.json({ error: 'bad appid' }, { status: 400 })
  const steamId = await getSteamId()
  const card = await getGameCard(appId, steamId)
  if (!card) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(card)
}
