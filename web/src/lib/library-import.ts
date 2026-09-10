export type ImportResult =
  | { status: 'ok'; owned: number; wishlist: number }
  | { status: 'profile_private' }
  | { status: 'error' }

/**
 * Trigger a library/wishlist import for the signed-in user.
 * Maps the import route's responses into a small discriminated result so the
 * UI can distinguish "your Steam profile is private" (409) from a generic error.
 */
export async function runLibraryImport(): Promise<ImportResult> {
  let res: Response
  try {
    res = await fetch('/api/library/import', { method: 'POST' })
  } catch {
    return { status: 'error' }
  }
  if (res.status === 409) return { status: 'profile_private' }
  if (!res.ok) return { status: 'error' }
  const body = await res.json().catch(() => ({} as any))
  return { status: 'ok', owned: body.owned ?? 0, wishlist: body.wishlist ?? 0 }
}
