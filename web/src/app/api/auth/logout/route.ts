import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/session'

export async function GET() {
  await clearSession()
  return NextResponse.redirect(`${process.env.APP_BASE_URL}/`)
}
