'use client'
import { useState } from 'react'
import { runLibraryImport } from '@/lib/library-import'

export function ImportButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function go() {
    if (busy) return
    setBusy(true)
    setMsg(null)
    const result = await runLibraryImport()
    if (result.status === 'ok') {
      location.reload()
      return
    }
    setBusy(false)
    setMsg(
      result.status === 'profile_private'
        ? 'Set your Steam profile + game details to Public, then retry.'
        : 'Import failed. Try again in a moment.',
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span className="chip on" role="button" aria-disabled={busy} onClick={go}>
        {busy ? 'Importing…' : 'Import my library'}
      </span>
      {msg && <span style={{ color: 'var(--dim)', fontSize: 12 }}>{msg}</span>}
    </span>
  )
}
