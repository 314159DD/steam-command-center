export const dynamic = 'force-dynamic'

import { getSteamId } from '@/lib/session'
import { getCollectorHealth } from '@/lib/queries'
import { redactApiKey, summarizeHealth } from '@/lib/health-utils'
import { TopNav } from '@/components/TopNav'

function relTime(d: Date | string | null): string {
  if (!d) return 'never'
  const diffMs = Date.now() - new Date(d).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}

export default async function StatusPage() {
  const steamId = await getSteamId()
  const rows = await getCollectorHealth()
  const { total, errors } = summarizeHealth(rows)

  return (
    <>
      <TopNav persona={steamId ? 'You' : null} active="/status" />
      <div className="barhead">
        Collector Health&nbsp;·&nbsp;{total} sources&nbsp;·&nbsp;{errors} error{errors !== 1 ? 's' : ''}
      </div>
      <div style={{ padding: '8px 18px 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ color: 'var(--gold)', textAlign: 'left', borderBottom: '1px solid var(--dim)' }}>
              <th style={{ padding: '0.4rem 0.6rem' }}>Source</th>
              <th style={{ padding: '0.4rem 0.6rem' }}>Status</th>
              <th style={{ padding: '0.4rem 0.6rem' }}>Last Success</th>
              <th style={{ padding: '0.4rem 0.6rem' }}>Last Run</th>
              <th style={{ padding: '0.4rem 0.6rem' }}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source} style={{ borderBottom: '1px solid #2a2d22' }}>
                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--gold)' }}>{row.source}</td>
                <td style={{ padding: '0.4rem 0.6rem' }}>
                  <span style={{
                    color: row.last_status === 'ok' ? '#56b756' : '#e55',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                  }}>
                    {row.last_status}
                  </span>
                </td>
                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--dim)' }}>
                  {relTime(row.last_success_at)}
                </td>
                <td style={{ padding: '0.4rem 0.6rem', color: 'var(--dim)' }}>
                  {relTime(row.updated_at)}
                </td>
                <td style={{ padding: '0.4rem 0.6rem', color: '#999', fontSize: '0.75rem', maxWidth: '400px', wordBreak: 'break-word' }}>
                  {row.last_detail ? redactApiKey(row.last_detail) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
