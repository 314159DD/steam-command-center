# Hover Card v2 - Design

**Date:** 2026-06-17
**Status:** Approved
**Supersedes (visually):** the card built in session 6 (`docs/design/2026-06-16-game-hover-card.md`). The plumbing (provider, `useGameHover`/`HoverLink`, `/api/game-card/[appid]`, cache, 0ms-show/100ms-grace-hide) stays; this is a layout, positioning, data, and icon revision of the card itself.

---

## Problem

The session-6 hover card works but is visually wrong: it's **too wide and too square** (360×380), reads as a heavy block, and dumps one fact per line. It uses emoji as indicators, positions itself above/below the hovered item, and leaves richer signals we already collect (Deck/Proton tier, ITAD all-time-low, screenshots) unused.

## Goals

1. **Narrower, upright rectangle** - not a square; denser.
2. **Anchor to the right of the hovered item** (flip left only when there's no room).
3. **Trim noise, add high-value data**: Deck/Proton tier, price + all-time-low, screenshots as trailer fallback.
4. **Replace all emoji with `lucide-react` icons.**

Non-goals: changing the hover plumbing/timing, the detail page, mobile/touch, IGDB activation.

---

## Design

### 1. Dimensions & shape
- Width **270px** (was 360).
- Media area: 16:9 → ~152px tall at 270 width.
- Padding **8px** (was 10), tighter line spacing.
- Result: a portrait/upright card, not a square.

### 2. Positioning - `hoverCardPosition` rewrite
Current helper returns `{top, left, placement: 'above'|'below'}` and stacks vertically. Replace with horizontal anchoring:

- **Default placement `'right'`**: `left = anchor.right + GAP`, `top = anchor.top`.
- **Flip to `'left'`** when `anchor.right + GAP + card.width > viewport.width` AND there's room on the left (`anchor.left - GAP - card.width >= 0`): `left = anchor.left - GAP - card.width`.
- **Vertical clamp** (independent of placement): if `top + card.height > viewport.height`, set `top = viewport.height - card.height - GAP`; if `top < GAP`, set `top = GAP`.
- `GAP = 8`. Signature: `hoverCardPosition(anchor: {top,bottom,left,right,width,height}, card: {width,height}, viewport: {width,height}) → {top, left, placement: 'right'|'left'}`. (Anchor gains `right`; the component already has the full `DOMRect`.)

### 3. Card layout (top → bottom)
1. **Media** - micro-trailer (autoplay, muted, loop, `playsInline`), `header_image` poster.
2. **Fallback only:** if no `trailer_movie_id`, show **screenshots** instead of the trailer image - first screenshot filling the 16:9 media area (no extra height; replaces, never adds). If neither trailer nor screenshots, fall back to `header_image`.
3. **Title row** - `name` (bold, white) + library badge (`owned`/`wishlist`) right-aligned if present.
4. **Meta line** - `developer · release_date` on one dimmed, truncated line (omit each part if missing).
5. **Stats row** - icon + value, inline: `Users` icon + 24h peak (`spy_ccu`, grouped); `Heart` icon + follows (`igdb_follows`, compact) when present.
6. **Tag pills** - plain-text pills (no emoji), max 5, from `spy_tags` keys (fallback `tags`).
7. **Badges row** - Deck/Proton tier as a `Gamepad2` icon + short label (e.g. "Deck: Verified" from `deck_verified`, else Proton tier capitalized); `ShieldCheck` + "VAC" only when `has_vac`. The always-on "Family sharing" line is **removed**.
8. **Price row** - `Tag` icon + `€{price}` and, when `itad_atl_cents` exists and differs, `· ATL €{atl}`; append `-{itad_cut}%` when `itad_cut > 0`. Gold.
9. **Rating** - `Star` icon + `{review_score}% · {compactCount(review_count)} reviews` when both present.
10. **Store link** - `ExternalLink` icon + `Store ↗` to `store.steampowered.com/app/{appId}`.

### 4. Icons
Add `lucide-react`. Icons used: `Users`, `Heart`, `Gamepad2`, `ShieldCheck`, `Tag`, `Star`, `ExternalLink`. Sized ~12–13px, `currentColor`/dimmed to match the palette. Delete the `tagEmoji` helper and its tests; remove the 😎 prefix on rating.

### 5. Feel
- Keep 0ms show / 100ms grace-hide and the on-card `cancelHide`.
- Add a subtle ~80ms opacity fade-in on mount (CSS transition).

### 6. Data - extend `getGameCard`
Add to the SELECT (all columns already exist on `games` / `user_libraries`):
`proton_tier, deck_verified, itad_atl_cents, itad_cut, recent_review_pct, review_trend`, and `playtime_forever` from the `user_libraries` join when `steamId` is present.

`CardData` type in `HoverPreview.tsx` gains the matching optional fields. (`recent_review_pct`/`review_trend`/`playtime_forever` are wired into the type now; rendering them is optional polish, not required for this pass.)

---

## Files touched
- `web/package.json` - add `lucide-react`.
- `web/src/lib/queries.ts` - extend `getGameCard` SELECT + return shape.
- `web/src/lib/hover-card.ts` - rewrite `hoverCardPosition`; delete `tagEmoji`; add `formatCardPrice(priceCents, atlCents, cut)` helper returning the price string.
- `web/src/components/HoverPreview.tsx` - new dimensions, positioning call, layout, icons, trailer-fallback screenshots.
- `web/src/test/hover-card.test.ts` (or existing helper test file) - rewrite positioning tests for right/left/clamp; remove `tagEmoji` tests; add `formatCardPrice` tests.

## Testing
- **TDD the pure helpers** (`hover-card.ts`):
  - `hoverCardPosition`: places right by default; flips left when no right room; clamps vertically top and bottom; keeps placement right when left also lacks room (stay right, clamp horizontally as last resort).
  - `formatCardPrice`: price only; price + ATL when differing; price + ATL + cut%; free/null handling.
- Component (visual) changes verified by `npm run build` + `npm test` green, then a live spot-check of `/api/game-card/730` rendering on the deployed site.

## Out of scope / follow-ups
- IGDB follows still render only once the Twitch dev app is activated (existing gap).
- Showing `playtime_forever` / `recent_review_pct` / `review_trend` in the card UI (data wired; rendering deferred).
- Touch/mobile hover behavior.
