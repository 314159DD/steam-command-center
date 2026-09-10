# Game Hover Preview Card - Design Spec

**Date:** 2026-06-16
**Status:** Approved (brainstorm), ready for implementation plan
**Area:** `collector/` enrichment + `db/` schema + `web/` (new API route + hover card component)

## Goal

On hovering any game title/card anywhere in the app, immediately show a rich preview
card: a muted, autoplaying, looping Steam **micro-trailer** at the top, plus key stats
(developer, release date, 24h peak, follows, tags, anti-cheat, family sharing, rating) and
a `Store ↗` link + an `In Library / Wishlist` badge.

## Decisions (from brainstorm)

- **v1 scope:** video + info card + `Store ↗` link + `In Library/Wishlist` badge. **Follow /
  Ignore are deferred** (they are net-new per-user game-state needing their own table +
  semantics).
- **Trigger:** the card *shows* immediately (0ms) on mouse-enter. The *hide* keeps a ~100ms
  grace so the cursor can move onto the card to click `Store ↗`; hovering the card cancels
  the hide. Moving to another title or scrolling dismisses instantly.
- **Video:** Steam's micro-trailer webm, keyed by **movie id** (not app id):
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{movie_id}/microtrailer.webm`
  - verified directly playable (`200 video/webm`). The old `appdetails` `webm`/`mp4` fields
  are gone (replaced by DASH/HLS streams that need a heavy player); the micro-trailer needs
  no player library. Games with no movie → fall back to header image (+ screenshots).
- **Coverage:** every title/card link, via one shared `useGameHover` hook - new-releases bar,
  all 3 discovery columns, the Recently-Updated feed, search, library, backlog, calendar.
  (Detail page excluded.)
- **Architecture:** ONE shared card (singleton portal), not one-per-title. Data fetched
  on-demand from a single API route reading Postgres. No live Steam call on page load; the
  video is a static CDN asset loaded only on hover.

## Non-goals / out of scope

- Follow / Ignore user actions and any per-user game-state table.
- DASH/HLS full-trailer playback (we use the micro-trailer webm only).
- A hover card on the game **detail** page.
- Touch/click preview - on touch devices there is no hover; tap still navigates to
  `/game/[appid]` (progressive enhancement).

---

## 1. Collector + schema

Extend the **existing** `appdetails` enrichment (`steam_catalog.parse_appdetails` /
`enrich_game`) - no new external API.

### 1.1 Migration `db/migrations/0008_game_card.sql`
Add to `games` (idempotent `add column if not exists`):

| Column | Type | Source (`appdetails` `data`) |
|---|---|---|
| `developer` | `text` | `developers[0]` |
| `has_vac` | `boolean` | `'Valve Anti-Cheat enabled'` ∈ `categories[].description` |
| `family_sharing` | `boolean` | `'Family Sharing'` ∈ `categories[].description` |
| `trailer_movie_id` | `bigint` | first `movies[].id`, preferring one with `highlight: true` |
| `screenshots` | `jsonb` | first ~4 `screenshots[].path_thumbnail` (video fallback) |

### 1.2 Parsing (`steam_catalog.parse_appdetails`)
Extend the returned dict with: `developer`, `has_vac`, `family_sharing`, `trailer_movie_id`,
`screenshots`. Helpers (pure, TDD'd):
- `pick_developer(data) -> str | None` → `developers[0]` or None.
- `pick_trailer_movie_id(data) -> int | None` → the first `movies` entry's `id`, preferring
  `highlight: true`; None if no movies.
- `category_flags(data) -> (has_vac, family_sharing)` → membership checks on
  `categories[].description`.
- `pick_screenshots(data, n=4) -> list[str]` → first `n` `path_thumbnail` URLs.

### 1.3 Writer (`store_writer`)
- Extend `upsert_games` to write the 5 new fields (column list + values + on-conflict set +
  param dict), defaulting to None/[] when absent.
- Add `detail_targets(self) -> list[int]`: `select app_id from games where developer is null`
  (the staleness selector for the new fields - `app_ids_missing_tags` won't re-fetch
  already-enriched games).

### 1.4 Pipeline (`run.py`)
Add a bounded re-enrichment pass: `detail_targets()[:N]` (e.g. N=60/cycle), call `enrich_game`
(already returns the new fields), `upsert_games`, health-record source `details`. Plus a
**one-time backfill** (a script re-running `enrich_game` for all existing games) so cards are
populated at launch rather than trickling in.

---

## 2. API route - `web/src/app/api/game-card/[appid]/route.ts`

`GET /api/game-card/[appid]` → JSON card payload, read from Postgres only:
```
{ app_id, name, header_image, developer, release_date, trailer_movie_id, screenshots,
  spy_ccu, igdb_follows, tags, has_vac, family_sharing, review_score, review_count,
  price_cents, itad_price_cents, current_players, lib }   // lib = 'owned'|'wishlist'|null
```
- `tags` = prefer `spy_tags` keys (richer), else `tags`.
- `current_players` = latest `player_counts` row for the app (optional; `spy_ccu` is the
  "24h peak").
- `lib` resolved from `user_libraries` for the signed-in `steamId` (null if anonymous).
- Returns a minimal payload (name + app_id) if the row is sparse; 404 only if the app_id
  doesn't exist.

---

## 3. Web - hover card components

### 3.1 `HoverPreviewProvider` (mounted once in `web/src/app/layout.tsx`)
React context holding `{ appId: number | null, anchorRect: DOMRect | null }`. Renders the
single `<GameHoverCard>` portal. Exposes `show(appId, rect)` / `hide()` with the ~100ms grace
timer (cleared if the card itself is hovered).

### 3.2 `useGameHover(appId)` hook
Returns `{ ref, onMouseEnter, onMouseLeave }`. `onMouseEnter` → `show(appId, ref.rect)`;
`onMouseLeave` → `hide()`. Dropped onto existing title/card links across surfaces - no markup
change beyond the handlers + ref.

### 3.3 `GameHoverCard` (singleton portal)
- On `appId` change: position via `hoverCardPosition(anchorRect, cardSize, viewport)`
  (above/below flip); fetch `/api/game-card/[appId]` with a module-level per-appid `Map`
  cache; render skeleton → card.
- Video: `<video src={microtrailerUrl(trailer_movie_id)} autoPlay muted loop playsInline
  poster={header_image}>` when `trailer_movie_id`; else header image (+ screenshots strip).
  `onError` → fall back to poster. On hide: pause + clear `src`.
- Card hover cancels the hide-grace (so `Store ↗` is clickable).
- Layout per the approved mockup: video → actions row (`Store ↗`, library badge) → name →
  developer → release date → 24h peak (`spy_ccu`) → follows (`igdb_follows`, compact) →
  emoji tag chips → anti-cheat (VAC) → family sharing → rating (`review_score` ·
  `review_count`).

### 3.4 Pure helpers (TDD'd) - `web/src/lib/hover-card.ts`
- `microtrailerUrl(movieId: number): string`
- `compactCount(n: number): string` - abbreviated, used for **Follows** (`4.83 M`, `12.3 K`).
- `groupedCount(n: number): string` - thousands-separated, used for **24h Peak**
  (`1,362,617`).
- `tagEmoji(tag: string): string` - known-tag → emoji map (FPS 🔫, Shooter 🔫, Multiplayer
  🕹️, Competitive 🥇, Action 💥, Team-Based 👥, RPG 🗡️, Strategy ♟️, …) + a default `•`.
- `hoverCardPosition(anchorRect, cardSize, viewport): { top, left, placement }` - flip
  above/below + clamp horizontally into the viewport.

### 3.5 Wiring (coverage)
Apply `useGameHover` to the title/card `<a>` in: `NewReleasesBar`, `DiscoveryStrip`,
`UpdatedFeed`, search results, `LibraryBrowser`, backlog, calendar.

---

## 4. Testing

**Collector (pytest):** `pick_developer`, `pick_trailer_movie_id` (highlight preference + no
movies), `category_flags` (VAC present/absent, family-sharing present/absent),
`pick_screenshots` (cap), and `upsert_games` writes the new fields.

**Web (vitest):** `microtrailerUrl`, `compactCount` + `groupedCount`, `tagEmoji` (known +
fallback), `hoverCardPosition` (flips when near the bottom edge, clamps near the right edge).
API route + components are thin and not unit-tested (project convention).

**Manual smoke:** hover a title → micro-trailer autoplays muted within the card; all fields
render; move cursor onto the card and click `Store ↗`; a game with no trailer shows the
header-image fallback.

---

## 5. Affected files (anticipated)

**Collector/DB:** `db/migrations/0008_game_card.sql` (new); `steam_collector/steam_catalog.py`
(parse helpers + emit fields); `steam_collector/store_writer.py` (`upsert_games` + new
`detail_targets`); `steam_collector/run.py` (details pass); one-time backfill script; tests.

**Web:** `src/app/api/game-card/[appid]/route.ts` (new); `src/lib/hover-card.ts` (new, pure
helpers); `src/components/GameHoverCard.tsx` (new); `src/components/HoverPreviewProvider.tsx`
(new); `src/app/layout.tsx` (mount provider); `useGameHover` hook (in the provider module or
its own file); wiring into `NewReleasesBar`, `DiscoveryStrip`, `UpdatedFeed`, search, library,
backlog, calendar; tests.
