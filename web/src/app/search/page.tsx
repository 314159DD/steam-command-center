import { getSteamId } from '@/lib/session'
import { searchGames } from '@/lib/queries'
import { TopNav } from '@/components/TopNav'
import { GameList } from '@/components/GameList'

export const dynamic = 'force-dynamic'

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const term = (q ?? '').trim()
  const steamId = await getSteamId()
  const persona = steamId ? 'You' : null
  const games = term ? await searchGames(term) : []
  return (
    <>
      <TopNav persona={persona} />
      <div className="barhead">{term ? `Search: ${term}` : 'Search'}</div>
      <div style={{ padding: '8px 18px 24px' }}>
        {!term
          ? <div style={{ color: 'var(--dim)', padding: 12 }}>Type to search the library.</div>
          : games.length === 0
            ? <div style={{ color: 'var(--dim)', padding: 12 }}>No games found for “{term}”.</div>
            : <GameList games={games} />}
      </div>
    </>
  )
}
