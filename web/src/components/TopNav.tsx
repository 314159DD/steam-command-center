import Link from 'next/link'

const TABS: { label: string; href: string }[] = [
  { label: 'DASHBOARD', href: '/' },
  { label: 'UPDATES', href: '/updates' },
  { label: 'NEW RELEASES', href: '/new-releases' },
  { label: 'TRENDING', href: '/trending' },
  { label: 'MONITOR', href: '/monitor' },
  { label: 'MY GAMES', href: '/library' },
  { label: 'BACKLOG', href: '/backlog' },
  { label: 'CALENDAR', href: '/calendar' },
  { label: 'STATUS', href: '/status' },
]

export function TopNav({ persona, active = '/' }: { persona: string | null; active?: string }) {
  return (
    <>
      <div className="valvebar"><span className="valve">VALVE</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        background: 'linear-gradient(180deg,#2c3026,#262a20)' }}>
        <Link href="/" style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', letterSpacing: 2, textDecoration: 'none' }}>STEAM</Link>
        <span style={{ color: 'var(--dim)' }}>Your personal command center</span>
        {/* Plain GET form so it works without JS and keeps TopNav a server component. */}
        <form action="/search" method="get" style={{ marginLeft: 'auto' }}>
          <input name="q" type="search" placeholder="Search games…" aria-label="Search games"
            style={{ background: '#282e22', color: '#e7e9da', border: '1px solid var(--gold)',
              borderRadius: 3, padding: '4px 8px', fontSize: 12, width: 160, outline: 'none' }} />
        </form>
        <span>
          {persona
            ? <a href="/api/auth/logout" className="valve" style={{ color: 'var(--yellow)' }}>{persona} ▾</a>
            : <a href="/api/auth/login" className="valve" style={{ color: 'var(--yellow)' }}>Sign in through Steam</a>}
        </span>
      </div>
      <nav className="nav">
        {TABS.map((t) => (
          <Link key={t.label} href={t.href} className={t.href === active ? 'act' : undefined}>{t.label}</Link>
        ))}
      </nav>
    </>
  )
}
