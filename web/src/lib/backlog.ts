const DECK_READY = new Set(['platinum', 'gold'])
const BARELY_PLAYED_MINUTES = 120

/**
 * "What to play next on Deck": owned games you've barely touched that run great
 * on Steam Deck / Proton, ranked by the best available score (Steam % / OpenCritic
 * / Metacritic). HLTB hours aren't available on our ITAD tier, so this is a
 * Deck-aware backlog rather than a finish-time budget.
 */
export function rankBacklog(rows: any[]): any[] {
  return rows
    .filter((r) => (r.playtime_forever ?? 0) < BARELY_PLAYED_MINUTES && DECK_READY.has(r.proton_tier))
    .map((r) => ({ ...r, best_score: Math.max(r.review_score ?? 0, r.opencritic ?? 0, r.metacritic ?? 0) }))
    .filter((r) => r.best_score > 0)
    .sort((a, b) => b.best_score - a.best_score || a.name.localeCompare(b.name))
}
