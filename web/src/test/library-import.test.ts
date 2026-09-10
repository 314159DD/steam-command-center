import { describe, it, expect, vi, afterEach } from 'vitest'
import { runLibraryImport } from '@/lib/library-import'

function mockFetch(impl: () => Promise<Response> | Response) {
  ;(globalThis as any).fetch = vi.fn(impl)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runLibraryImport', () => {
  it('POSTs to the import route and returns counts on success', async () => {
    mockFetch(() => new Response(JSON.stringify({ owned: 42, wishlist: 7 }), { status: 200 }))
    const result = await runLibraryImport()
    expect(result).toEqual({ status: 'ok', owned: 42, wishlist: 7 })
    expect((globalThis as any).fetch).toHaveBeenCalledWith('/api/library/import', { method: 'POST' })
  })

  it('maps a 409 to profile_private (so the UI can prompt to go public)', async () => {
    mockFetch(() => new Response(JSON.stringify({ error: 'profile_private', owned: 0 }), { status: 409 }))
    expect(await runLibraryImport()).toEqual({ status: 'profile_private' })
  })

  it('returns error on a non-ok server response', async () => {
    mockFetch(() => new Response('boom', { status: 500 }))
    expect(await runLibraryImport()).toEqual({ status: 'error' })
  })

  it('returns error when the request itself throws', async () => {
    mockFetch(() => { throw new Error('network down') })
    expect(await runLibraryImport()).toEqual({ status: 'error' })
  })
})
