# New Releases Redesign - Design Spec

**Date:** 2026-06-16
**Status:** Approved (brainstorm), ready for implementation plan
**Area:** `web/` dashboard layout + `collector/` data engine + `db/` schema

## Problem

The current NEW RELEASES column sources Steam's "newest by release date" firehose
(`category1=998 sort_by=Released_DESC`) and applies a two-tier filter (`rankNewReleases`:
drop junk/confidently-bad, then split into *proven* vs *promising*). Because a raw
newest-by-date feed is overwhelmingly zero-signal shovelware, the column is permanently
either thin (proven-only) or padded with unknowns (promising). It does not reliably
surface recent games that are actually worth checking out.

## Goals

1. Promote new releases to its own prominent **horizontal bar** (peer of the
   "★ Worth Your Attention Today" digest), not a cramped discovery column.
2. Replace the weak ranking with a **composite, taste-weighted curation engine** that
   fuses critic + player + buzz signals so the bar surfaces genuinely worthwhile recent
   games - quality over quantity.
3. Add a real **buzz/anticipation** signal and a second independent critic source by
   integrating **IGDB** (Twitch's game DB) - the strongest *free* "other public gaming
   source," since OpenCritic's API is now fully paywalled (RapidAPI key required on every
   endpoint, verified 2026-06-16).

## Decisions (from brainstorm)

- **Curation philosophy:** Blend (critic + player + buzz), re-weighted toward the user's
  owned-genre tags. Ranked, not hard-gated - but with a minimum quality floor.
- **Recency window:** **30 days** (long enough for critic/early-review signals to exist,
  still clearly "new").
- **Engine:** Approach B (full) - Steam stays the candidate net; IGDB enriches on top.
  Built complete, not phased.
- **Empty/thin rule:** Show only games clearing the floor. If few qualify, show few  - 
  **never pad with slop.** A subtle tail note replaces filler.

## Non-goals / out of scope

- OpenCritic discovery feed (paywalled). We keep OpenCritic *scores* via the existing ITAD
  `/games/info/v2` path only.
- IGDB-led discovery (Approach C) - Steam remains the candidate source.
- Any frontend → 3rd-party live call. IGDB is **collector-only** (architecture invariant:
  the frontend reads only Postgres snapshots).
- Changing trending / top-sellers / digest logic.

---

## 1. Layout & UX (`web/`)

**Dashboard reflow (`web/src/app/page.tsx`):**

```
┌─────────────────────────────────────────────┐
│ ★ WORTH YOUR ATTENTION TODAY      [digest]   │  existing bar
├─────────────────────────────────────────────┤
│ ✦ NEW RELEASES WORTH CHECKING OUT [scroller] │  NEW bar
├───────────────┬───────────────┬─────────────┤
│ MOST PLAYED   │ TRENDING NOW  │ TOP SELLERS  │  3 cols
│ ▲ live counts │               │ / SPECIALS   │
├───────────────┴───────────────┴─────────────┤
│ Recently Updated · Your Library (FULL WIDTH) │  feed
└─────────────────────────────────────────────┘
```

- **New `NewReleasesBar` component** placed directly under `DigestStrip` - same full-width
  bar treatment. Horizontally-scrollable row of cards; target **12**, hard-cap **16**.
- `DiscoveryStrip` columns change `[NEW RELEASES, TRENDING, TOP SELLERS]` →
  `[MOST PLAYED, TRENDING NOW, TOP SELLERS/SPECIALS]`.
- **Remove the `MonitorRail` right rail.** Fold its live player-count + ▲/▼ momentum
  rendering into the new first `MOST PLAYED` column (restyled to column width). The
  Recently-Updated feed becomes **full-width**.

**New-releases card content:** thumbnail, name, relative release date ("3d ago"), and a
compact signal row - Steam review % (if any), best critic badge
(Metacritic / OpenCritic / IGDB aggregated), a **🔥 hype badge** when IGDB anticipation is
high, price/deal tag, and OWNED/WISHLIST when in the user's library. Card → `/game/[appid]`.

**Quality-over-quantity behavior:** cards ranked by composite score; hard junk
(junk-tags, confidently-bad) dropped entirely; only games clearing the floor are shown. If
only N clear it, show N - no padding. Subtle tail note (e.g. "that's everything worth
flagging right now") instead of filler.

**Dedicated `/new-releases` page** keeps its nav tab and reuses the same engine - the full
unsliced ranked list.

---

## 2. Data engine (`collector/`)

### 2.1 Candidate pool & recency window

- Keep `fetch_new_releases` (Steam store search, `category1=998 sort_by=Released_DESC`),
  widened to ~3–4 pages (~300–400 newest) so enough survive the 30-day cut.
- **New parsed date column `games.released_at date`**, populated by a collector
  date-parser that normalizes Steam's free-text `release_date` (observed formats include
  `"Jun 14, 2026"` and `"17 Jul, 2025"` - handle both; `null` on unparseable / "Coming
  soon"). Window filter: `released_at >= now() - interval '30 days'`.

### 2.2 IGDB integration - `collector/steam_collector/igdb.py` (new)

- **Auth:** Twitch OAuth client-credentials flow → cached bearer token (refresh on
  expiry/401). Env: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`.
- **Exact Steam-appid matching:**
  1. `POST /v4/external_games` - `fields game,uid; where category = 1 & uid = ("570",…); limit 500;`
     → appid → IGDB game id.
  2. `POST /v4/games` - `fields hypes,follows,aggregated_rating,aggregated_rating_count,total_rating; where id = (…); limit 500;`
- **Pacing:** IGDB allows 4 req/s; the 30-day candidate set (~50–150 games) is 1–2 batched
  calls per cycle. Bounded backfill over candidates with missing/stale IGDB data.
- **Resilience:** per-pass try/except; never breaks a cycle; `_record(writer, "igdb", …)`
  health logging (surfaces on `/status`). API key/secret never logged (redaction already in
  `_record`).

### 2.3 Pipeline wiring (`run.py`)

- New IGDB backfill pass, exception-isolated, after the existing enrichment passes.
- New-release candidates continue to flow through the existing review / owners / ITAD-critic
  enrichment; ensure they are prioritized so signals are fresh for the bar.

---

## 3. Schema - `db/migrations/0007_new_releases.sql`

Add to `games` (all `add column if not exists`, idempotent):

| Column                   | Type        | Source                          |
|--------------------------|-------------|---------------------------------|
| `released_at`            | `date`      | parsed from `release_date`      |
| `igdb_id`                | `bigint`    | IGDB external_games match       |
| `igdb_hypes`             | `int`       | IGDB `hypes`                    |
| `igdb_follows`           | `int`       | IGDB `follows`                  |
| `igdb_aggregated_rating` | `numeric`   | IGDB `aggregated_rating` (0–100)|
| `igdb_rating_count`      | `int`       | IGDB `aggregated_rating_count`  |
| `igdb_checked_at`        | `timestamptz` | last IGDB fetch               |

Apply to Neon via `psql $DATABASE_URL -f db/migrations/0007_new_releases.sql` (consistent
with prior migrations; collector fails safe on missing columns until applied).

---

## 4. Composite scoring - `web/src/lib/filters.ts`

Extend `newReleaseScore` / `rankNewReleases`. **Pure, deterministic, no live calls, TDD'd**
(consistent with existing functions). Components normalized to 0–1, weighted by named
constants:

- **critic** = `max(metacritic, opencritic, igdb_aggregated_rating) / 100`, scaled by
  rating-count confidence (more critics → more trust).
- **player** = `review_score/100 × min(1, review_count/50)` (existing confidence ramp) plus
  a recent-review momentum bonus (`recent_review_pct` / `review_trend`).
- **buzz** = log-normalized blend of `igdb_hypes` + `igdb_follows` + SteamSpy owners
  lower-bound + `popularnew` membership.
- **taste** = multiplier derived from existing `tag_weights` over the game's tags.
- `final = (wC·critic + wP·player + wB·buzz) × tasteMult`.

**Floor / filtering:**
- Drop junk-tag games and confidently-bad games (enough reviews to trust a low score)  - 
  reuse existing `JUNK_TAGS` / confidently-bad logic.
- Keep only games clearing `MIN_COMPOSITE` **or** carrying one strong signal (real critic
  score, solid review pool, or high hype). This produces the "show fewer, don't pad"
  behavior.

Web query `getNewReleases()` in `queries.ts` selects candidates **directly from `games`
windowed by `released_at >= now() - interval '30 days'`** (plus all signal columns) - it does
**not** read the `new_release` discovery-snapshot category. The collector still calls
`fetch_new_releases` to upsert + enrich those candidate rows, but the dashboard's old
`getDiscovery('new_release')` read is removed in favor of `getNewReleases()`. Ranking is
applied by `rankNewReleases`; the bar slices to 12, the `/new-releases` page shows the full
list; taste is passed in like other discovery queries.

---

## 5. External setup (one-time, by the maintainer)

- Create a free Twitch dev app at <https://dev.twitch.tv/console/apps> → client id + secret.
- Set `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` in `collector/.env` and as GitHub Actions
  secrets. (Web does **not** need them - IGDB is collector-only.)

---

## 6. Testing

**Collector (pytest + respx):**
- `igdb.py` - token fetch + cache, appid→igdb_id mapping, field parse, multi-batch, error
  tolerance (401 refresh, non-200 → skip).
- Release-date parser - multiple Steam formats → `date`, `null` on junk / "Coming soon".
- `run.py` - IGDB pass is exception-isolated and health-recorded.

**Web (vitest):**
- Composite `newReleaseScore` / `rankNewReleases` - component weighting, floor behavior,
  taste multiplier, thin-result (show-fewer) behavior, junk/confidently-bad drops.
- `NewReleasesBar` render gating (hype badge thresholds, empty/tail-note state).

---

## 7. Affected files (anticipated)

**Collector:** `steam_collector/igdb.py` (new), `steam_collector/run.py`,
`steam_collector/store_writer.py` (writer + stale/missing-IGDB selectors, `released_at`
upsert), `steam_collector/steam_catalog.py` or wherever `release_date` is parsed (add
`released_at`), `pyproject`/requirements (no new dep - `httpx` already present), tests.

**DB:** `db/migrations/0007_new_releases.sql` (new).

**Web:** `src/components/NewReleasesBar.tsx` (new), `src/app/page.tsx` (reflow),
`src/components/DiscoveryStrip.tsx` (+ MOST PLAYED live-count column / fold MonitorRail),
`src/lib/filters.ts` (composite), `src/lib/queries.ts` (`getNewReleases`),
`src/app/new-releases/page.tsx` (reuse engine), tests.
