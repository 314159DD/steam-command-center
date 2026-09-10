# New Releases Spotlight - Design

**Date:** 2026-06-17
**Status:** Approved
**Replaces (visually):** the session-5 `NewReleasesBar` horizontal-scroll row (`web/src/components/NewReleasesBar.tsx`).

---

## Problem

The dashboard's first element is `NewReleasesBar` - a full-width **horizontal scroll** of 184px cards (`overflowX: 'auto'`, `target = 12`). Only ~5–6 fit on screen; the rest are hidden behind a sidescroll, which is poor on desktop and hides curated picks. The new-release curation has a quality floor, so the real count is often 4–8, not 12.

## Goal

Replace the sidescroll with a **featured spotlight you arrow through**: one release shown large/in-focus, the others visible as a thumbnail filmstrip below, with ‹ › controls (and click) to move focus. Nothing hidden behind a horizontal scroll.

Non-goals: changing the curation/ranking (`rankNewReleases`), autoplaying trailers in the hero, touching any other dashboard section.

---

## Design

### Component
Rewrite `NewReleasesBar` as a **client component** `NewReleasesSpotlight` (`'use client'`, holds `activeIndex` state). It reuses the existing `NewReleaseCard` type and the helpers `isHyped`, `tailNote`, `bestCritic`, `daysAgo` (moved into the new file unchanged). Props are unchanged: `{ games: NewReleaseCard[]; target?: number }` (default `target = 12`). `shown = games.slice(0, target)`.

### Layout (top → bottom)
1. **Header** - unchanged: `✦ New Releases Worth Checking Out` (`className="barhead"`).
2. **Featured panel** - the item at `activeIndex`, shown large:
   - 16:9 image via `GameThumb` (centered, full panel width, `maxHeight: 300`).
   - Meta row beneath the image, same fields/colors as today: `daysAgo` (dim), `review_score%` (green `#6db86d`), `★bestCritic` (gold), `🔥 hyped` (yellow, when `isHyped`), `lib` (uppercase, when present), and price `€{(itad_price_cents ?? price_cents)/100}` (gold, right-aligned).
   - The panel is a `HoverLink` (appId, `href={/game/${appId}}`) so the hover-preview card still works on the hero.
3. **‹ › arrows** - buttons absolutely positioned over the left/right edges of the featured image, vertically centered. `onClick` calls `stopPropagation()` + `preventDefault()` (so they cycle focus without triggering the HoverLink navigation) and advances `activeIndex` by ∓1. Rendered only when `shown.length > 1`.
4. **Filmstrip** - a row of all `shown` items as small (~100×47, 16:9) `GameThumb` thumbnails. The active index gets a gold border (`1px solid var(--gold)`) + full opacity; the rest are dimmed (`opacity: 0.6`). Clicking a thumbnail sets `activeIndex`. The row **wraps** (`flexWrap: 'wrap'`, gap 8) - it never scrolls horizontally. Doubles as the position indicator. Rendered only when `shown.length > 1`.
5. **Tail note** - unchanged: `tailNote(shown.length, target)` shown below when present.

### Behavior
- ‹ › arrows and filmstrip clicks both move focus; the index **wraps around** at both ends (next from last → 0; prev from 0 → last).
- Keyboard: `←` / `→` move focus when the panel is focused (container `tabIndex={0}`, `onKeyDown`).
- **0 items** → the existing empty state: "Nothing new clears the bar right now - check back in a day or two."
- **1 item** → featured panel only; no arrows, no filmstrip.
- No autoplay; the hero is a static image (the hover-card already provides the trailer on hover).

### Pure logic (unit-tested)
```ts
// cycle an index by delta with wrap-around; returns 0 for an empty list
export function cycleIndex(current: number, delta: number, length: number): number
```
- `cycleIndex(0, +1, 5) === 1`
- `cycleIndex(4, +1, 5) === 0`   (wrap forward)
- `cycleIndex(0, -1, 5) === 4`   (wrap backward)
- `cycleIndex(0, +1, 1) === 0`   (single item)
- `cycleIndex(0, +1, 0) === 0`   (empty guard)

---

## Files touched
- `web/src/components/NewReleasesBar.tsx` → rewritten as `web/src/components/NewReleasesSpotlight.tsx` (delete the old file, create the new one). Exports `NewReleasesSpotlight`, `cycleIndex`, and keeps `NewReleaseCard`, `isHyped`, `tailNote`.
- `web/src/app/page.tsx` - update the import and the one usage (`<NewReleasesBar .../>` → `<NewReleasesSpotlight .../>`); props unchanged.
- `web/src/test/new-releases-spotlight.test.ts` (new) - `cycleIndex` unit tests.

## Testing
- **TDD** `cycleIndex` with the cases above.
- Existing `web/src/test/rankNewReleases.test.ts` stays green (ranking is untouched).
- Component visuals: `npm test` + `npm run build` green, then a live spot-check on the deployed dashboard - confirm the hero shows one release large, arrows/filmstrip cycle the focus with wrap-around, the filmstrip wraps instead of scrolling, and the hover-card still fires on the hero.

## Out of scope / follow-ups
- Autoplaying the hero trailer (`trailer_movie_id` is available post-backfill) - deferred; hover-card covers trailers.
- Any change to `rankNewReleases` scoring or the 30-day window.
