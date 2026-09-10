import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = () => {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not set')
  return new TextEncoder().encode(s)
}
const COOKIE = 'sj_session'

export async function setSession(steamId: string): Promise<void> {
  const token = await new SignJWT({ steamId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret())
  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  })
}

export async function getSteamId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return (payload.steamId as string) ?? null
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  ;(await cookies()).delete(COOKIE)
}
