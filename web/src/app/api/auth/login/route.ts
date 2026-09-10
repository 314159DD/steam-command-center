import { NextResponse } from 'next/server'
import { buildLoginUrl } from '@/lib/steam-openid'

export async function GET() {
  const returnTo = `${process.env.APP_BASE_URL}/api/auth/callback`
  return NextResponse.redirect(buildLoginUrl(returnTo))
}
