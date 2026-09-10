import { tasteScore, type TagWeights } from './taste'

export type Toggles = { quality: boolean; taste: boolean; my_games: boolean; global: boolean }
export type DiscoveryGame = {
  app_id: number; name: string; tags: string[]
  review_count: number | null; review_score: number | null
}

const MIN_REVIEWS = 25
const MIN_SCORE = 50
const JUNK_TAGS = new Set(['Hentai', 'Nudity', 'Sexual Content'])

// --- New-release quality ranking --------------------------------------------
// New releases inherently have few reviews, so we can't apply the same review
// gates as the other columns. Instead we drop the clearly-bad (junk tags, or a
// confidently-low review score) and split the survivors into two tiers - proven
// (a real positive signal) and promising (not yet reviewed) - each ranked
// best-first by a "worth checking" score. See splitNewReleaseTiers.

export type NewReleaseGame = DiscoveryGame & {
  owners_estimate?: string | null
  opencritic?: number | null
  metacritic?: number | null
  igdb_aggregated_rating?: number | null
  igdb_rating_count?: number | null
  igdb_hypes?: number | null
  igdb_follows?: number | null
  review_trend?: 'up' | 'down' | 'flat' | null
  popular_new?: boolean
}

// Enough reviews that a low score is a real verdict, not just early noise.
const JUDGE_MIN_REVIEWS = 8
const JUDGE_MIN_SCORE = 65
// Owners lower-bound (from "a .. b" estimate) above which we treat the game as
// having real traction, worth a small bump.
const OWNERS_FLOOR = 50_000

// Hard quality gate for the NEW RELEASES column: a recent release must carry at
// least one genuine positive signal to show at all.
const SIGNAL_MIN_REVIEWS = 10
const SIGNAL_MIN_SCORE = 65

// Composite weights (critic + player + buzz) and the minimum score to surface.
const W_CRITIC = 0.4
const W_PLAYER = 0.35
const W_BUZZ = 0.25
const MIN_COMPOSITE = 0.18
const TASTE_PER_TAG = 0.15   // each matching owned tag adds up to...
const TASTE_CAP = 0.5        // ...this much multiplier headroom

/** Does this recent release have at least one real positive quality signal? */
export function hasQualitySignal(g: NewReleaseGame): boolean {
  const reviews = g.review_count ?? 0
  const score = g.review_score ?? 0
  if (reviews >= SIGNAL_MIN_REVIEWS && score >= SIGNAL_MIN_SCORE) return true
  if ((g.opencritic ?? 0) > 0 || (g.metacritic ?? 0) > 0) return true
  if (ownersLowerBound(g.owners_estimate) >= OWNERS_FLOOR) return true
  return false
}

/** Parse the lower bound of a SteamSpy-style "20,000 .. 50,000" owners range. */
export function ownersLowerBound(estimate: string | null | undefined): number {
  if (!estimate) return 0
  const first = estimate.split('..')[0]
  const n = parseInt(first.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function criticComponent(g: NewReleaseGame): number {
  const best = Math.max(g.metacritic ?? 0, g.opencritic ?? 0, g.igdb_aggregated_rating ?? 0)
  return clamp01(best / 100)
}

function playerComponent(g: NewReleaseGame): number {
  const reviews = g.review_count ?? 0
  const confidence = Math.min(1, reviews / 50)
  const base = (g.review_score ?? 0) / 100 * confidence
  const momentum = g.review_trend === 'up' ? 0.1 : g.review_trend === 'down' ? -0.1 : 0
  return clamp01(base + momentum)
}

function buzzComponent(g: NewReleaseGame): number {
  const hype = Math.min(1, Math.log10((g.igdb_hypes ?? 0) + 1) / 3)        // ~1000 -> 1
  const follow = Math.min(1, Math.log10((g.igdb_follows ?? 0) + 1) / 4)    // ~10000 -> 1
  const owners = Math.min(1, Math.log10(ownersLowerBound(g.owners_estimate) + 1) / 6) // ~1M -> 1
  const popular = g.popular_new ? 0.15 : 0
  return clamp01(0.5 * hype + 0.3 * follow + 0.2 * owners + popular)
}

function tasteMultiplier(g: NewReleaseGame, weights: TagWeights): number {
  const boost = Math.min(TASTE_CAP, tasteScore(g.tags ?? [], weights) * TASTE_PER_TAG)
  return 1 + boost
}

/** Higher = more worth surfacing. Pure, deterministic, no live calls. */
export function newReleaseScore(g: NewReleaseGame, weights: TagWeights = {}): number {
  const blended = W_CRITIC * criticComponent(g) + W_PLAYER * playerComponent(g) + W_BUZZ * buzzComponent(g)
  return blended * tasteMultiplier(g, weights)
}

/** A game strong enough to surface even if its blended score is modest. */
function hasStrongSignal(g: NewReleaseGame): boolean {
  const bestCritic = Math.max(g.metacritic ?? 0, g.opencritic ?? 0, g.igdb_aggregated_rating ?? 0)
  if (bestCritic >= 70) return true
  if ((g.review_count ?? 0) >= SIGNAL_MIN_REVIEWS && (g.review_score ?? 0) >= SIGNAL_MIN_SCORE) return true
  if ((g.igdb_hypes ?? 0) >= 200) return true
  return false
}

/**
 * Split recent releases into two quality tiers for the NEW RELEASES column.
 * First drops the clearly-unwanted from ALL games: junk-tag games and
 * confidently-bad games (enough reviews to trust a low score). The survivors
 * are then partitioned:
 *   - `proven`: carry a genuine positive signal (enough good reviews, a critic
 *     score, or real owner traction - see hasQualitySignal).
 *   - `promising`: not junk and not confidently bad, but no strong signal yet -
 *     mostly brand-new/unreviewed releases that simply haven't accrued reviews.
 * Each tier is sorted independently best-first by newReleaseScore (desc), with
 * name.localeCompare as the stable tiebreak.
 */
export function splitNewReleaseTiers<T extends NewReleaseGame>(
  games: T[],
): { proven: T[]; promising: T[] } {
  const survivors = games
    .filter((g) => !(g.tags ?? []).some((t) => JUNK_TAGS.has(t)))
    .filter((g) => {
      // Drop when we have enough reviews to trust a low score.
      const reviews = g.review_count ?? 0
      if (g.review_score != null && reviews >= JUDGE_MIN_REVIEWS && g.review_score < JUDGE_MIN_SCORE) return false
      return true
    })

  // Decorate-sort-undecorate: compute newReleaseScore once per game, not on
  // every comparison. Tiebreak by name for stable, deterministic ordering.
  const byScore = (gs: T[]) =>
    gs
      .map((g) => ({ g, s: newReleaseScore(g, {}) }))
      .sort((a, b) => b.s - a.s || a.g.name.localeCompare(b.g.name))
      .map((x) => x.g)

  return {
    proven: byScore(survivors.filter((g) => hasQualitySignal(g))),
    promising: byScore(survivors.filter((g) => !hasQualitySignal(g))),
  }
}

/**
 * Curate recent releases for the NEW RELEASES bar. Drops junk-tag and
 * confidently-bad games outright, then keeps only games that clear MIN_COMPOSITE
 * or carry a strong signal - ranked best-first by the composite score. Quality
 * over quantity: if few qualify, few are returned (callers must not pad).
 */
export function rankNewReleases<T extends NewReleaseGame>(games: T[], weights: TagWeights = {}): T[] {
  return games
    .filter((g) => !(g.tags ?? []).some((t) => JUNK_TAGS.has(t)))
    .filter((g) => {
      const reviews = g.review_count ?? 0
      if (g.review_score != null && reviews >= JUDGE_MIN_REVIEWS && g.review_score < JUDGE_MIN_SCORE) return false
      return true
    })
    .map((g) => ({ g, s: newReleaseScore(g, weights) }))
    .filter(({ g, s }) => s >= MIN_COMPOSITE || hasStrongSignal(g))
    .sort((a, b) => b.s - a.s || a.g.name.localeCompare(b.g.name))
    .map((x) => x.g)
}

function passesQuality(g: DiscoveryGame, newReleases: boolean): boolean {
  // New releases inherently have few reviews, so the review gates would wipe the
  // whole column. Only the junk-tag filter applies to them.
  if (!newReleases) {
    if ((g.review_count ?? 0) < MIN_REVIEWS) return false
    if ((g.review_score ?? 0) < MIN_SCORE) return false
  }
  if ((g.tags ?? []).some((t) => JUNK_TAGS.has(t))) return false
  return true
}

export function applyDiscoveryFilters(
  games: DiscoveryGame[], weights: TagWeights, toggles: Toggles,
  opts: { newReleases?: boolean } = {},
): DiscoveryGame[] {
  let out = [...games]
  if (toggles.quality) out = out.filter((g) => passesQuality(g, opts.newReleases ?? false))
  if (toggles.taste) {
    out = out
      .map((g) => ({ g, s: tasteScore(g.tags ?? [], weights) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.g)
  }
  return out
}
