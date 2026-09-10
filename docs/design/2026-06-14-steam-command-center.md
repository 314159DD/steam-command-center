# Steam Command Center - Design Spec

> HISTORICAL ARTIFACT (2026-06-14). This spec names **Supabase** as the store, but the project shipped on **Neon Postgres** (no Supabase anywhere; `web/` uses `@neondatabase/serverless`, `collector/` uses `psycopg`; the `supabase/` folder is now `db/`). Read "Supabase" below as "Neon Postgres."

**Date:** 2026-06-14
**Status:** Approved design, ready for implementation planning

---

## 1. What this is

A personal "command center" web app for staying on top of Steam: a single daily-glance
dashboard that answers *"what's new, what's hot, and - most importantly - what just got
updated in the games I care about."* It replaces the daily ritual of manually crawling the
Steam client + steamdb.info, which are slow, noisy, and bad at surfacing fresh activity.

Built for the user first, with clean enough architecture to become a public product later.

### The core problem it solves
- The Steam client is hard to navigate; the front page rotation is mostly noise.
- The one genuinely useful bit - Steam's "Recently Updated" - only shows ~5 entries and
  dumps you into the firehose at `/news/` when you want more.
- SteamDB's "Most Played" and "Trending" are great but live on a reference site, not a
  personal hub, and SteamDB has no API and bans scrapers.
- Nobody cleanly combines **new releases + trending/most-played + classified "what just got
  updated"** into one fast, personalized, daily-check screen. That gap is the product.

---

## 2. Primary jobs (in priority order)

When the user opens the hub in the morning, it should answer, top to bottom:

1. **What just got updated** (the hero) - games the user owns or wishlists that shipped an
   update, classified by size (MAJOR / UPDATE / HOTFIX / CONTENT), newest first.
2. **What's new to discover** - new releases, filtered for quality + taste.
3. **What's trending / most played right now** - live player counts on big games, with
   up/down momentum vs. recent history.
4. **Top sellers / specials** - secondary discovery + deal awareness.

---

## 3. Personalization via Steam login

- **Sign in through Steam (OpenID)** - standard, password-less; yields the user's SteamID.
- With SteamID + a Steam Web API key, pull (requires public profile, a one-time toggle):
  - `GetOwnedGames` → owned titles + `playtime_forever` and `playtime_2weeks`
  - `GetRecentlyPlayedGames`
  - Wishlist
- **Why it matters technically:** knowing the user's library + wishlist scopes the hardest
  feature - the Updated feed - down to a tractable per-game news lookup instead of a global
  build-watcher. Login turns the hard problem into an easy one for v1.
- **Taste signal:** genre/tag affinity is derived from owned + recently-played titles and
  used to rank discovery feeds.

---

## 4. Noise filtering - layered, toggleable

New releases on Steam are a firehose of shovelware. Filtering is **two layers, each a toggle
chip** the user can flip on/off to see more or less noise:

1. **Quality filter** - drop obvious junk: minimum review count/score threshold, filter
   known asset-flip / ultra-low-effort tags.
2. **Taste match** - rank what's left by the user's genre/tag affinity (a new soulslike
   floats up; another farming sim sinks).

Additional toggle chips on the Updated feed: **My games** (owned + wishlist only) vs.
**Global updates** (Phase B). All toggles persist per user.

---

## 5. Visual design (locked)

Authentic **2003-era Steam** aesthetic, applied as a theme over one clean single-page
layout (NOT literal draggable windows).

- **Palette:** outer background `#282e22`; content panel `#31352a`; near-black bars
  `#0c0d09`; tan/gold accents `#c2a868`; bright-yellow "GOLD" emphasis `#e9e600`; light-grey
  body text `#c7c9ba`; beveled medium-olive section header bars `#878b67`.
- **Chrome:** black `VALVE` strip, white pipe Steam logo + "STEAM", black centered nav
  (DASHBOARD / UPDATES / NEW RELEASES / TRENDING / MONITOR / LIBRARY), beveled "Latest
  News"-style olive section headers, legal footer.
- **Type:** Tahoma / MS Sans Serif, small, dense.
- **Layout skeleton (approved):** three-column discovery strip up top (New Releases /
  Trending / Top Sellers, styled like the HL2 Bronze/Silver/Gold tiers) → "Recently Updated"
  hero below with filter chips → live **Monitor** rail on the right with a player-count graph.
- **Update badges:** MAJOR = bright-yellow GOLD treatment; CONTENT = tan; UPDATE = outlined
  olive; HOTFIX = amber. Rows carry OWNED (with playtime) / WISHLIST flags.
- Reference mockup: internal design exploration (not included in this repo).

---

## 6. Architecture

**One snapshot store, fed by collectors, read by a fast frontend.** The Updated feed and
player-count momentum both require comparing *now vs. earlier*, so a persistent store with
history is mandatory - the frontend never calls Steam live on page load.

```
   (A) Easy Collector        (B) Build-Watcher        (C) Live "refresh now"
   Steam store JSON           SteamKit2 global         on-demand proxy for a
   new/trending/top/          depot changelist =       single game drill-down
   players + per-game news    global classified        (optional sugar)
   for owned/wishlist          updates
          \                        |                          /
           \                       v                         /
            ----->   SUPABASE (Postgres snapshot store)  <----
                     games · snapshots · updates · users · libraries
                                     |
                                     v
                     Next.js hub (Vercel) - reads the store,
                     personalizes, renders, persists toggles
```

### Components
- **Collector worker (Python, on Railway)** - scheduled. Pulls Steam's undocumented-but-
  stable store JSON endpoints (`featuredcategories`, store `search` with New & Trending /
  Top Sellers / Specials / Popular Upcoming), `GetNumberOfCurrentPlayers` for tracked
  titles, and `GetNewsForApp` (ISteamNews) for each game in any user's library/wishlist.
  Normalizes + upserts into Supabase. Computes update classification from the news/event
  type + heuristics on the patch-notes body.
- **Supabase (Postgres)** - the store. History retained so diffs ("what changed since
  yesterday", "player count spiking") are cheap reads. Schema designed up front to hold
  global updates (Phase B) and multi-user libraries without rework.
- **Next.js frontend (Vercel)** - Steam OpenID login, library/wishlist import, the dashboard,
  the layered toggle filters, per-user preference persistence. Reads Supabase only.

### Data flow (Phase A)
1. User signs in with Steam → SteamID stored → library + wishlist imported into Supabase.
2. Collector (scheduled, ~every 30 min for store/news; tighter for big-game player counts)
   refreshes snapshots and per-game news for all tracked apps.
3. Update classifier tags each new news item: MAJOR / UPDATE / HOTFIX / CONTENT.
4. Frontend reads the store, applies the user's quality + taste filters and toggle state,
   renders the dashboard.

### Error handling
- Steam endpoints are undocumented and occasionally flaky: collector retries with backoff,
  treats a failed source as "stale, keep last snapshot" rather than blanking the UI.
- Never hammer Steam from the frontend → no rate-limit/ban exposure.
- Private Steam profile → detect on import, show a clear "set your profile to public" prompt
  rather than failing silently.
- Classifier uncertain → default to neutral "UPDATE" rather than mislabeling MAJOR.

---

## 7. Phasing

The end state includes all three data sources; build order keeps a usable tool in hand early.

- **Phase A - Snapshot Hub (v1, the usable daily tool):** Steam login, library/wishlist
  import, full dashboard (discovery strip + live Monitor + Recently Updated hero scoped to
  the user's games), layered toggle filters, the locked 2003 skin. Pull-only.
- **Phase B - Global Build-Watcher:** SteamKit2-style worker watching Steam's global depot
  changelists (the SteamDB approach) to surface *global* classified updates, not just the
  user's games. Writes into the same `updates` table; the "Global updates" toggle lights up.
- **Phase C - Notifications + extras:** Telegram daily digest (MAJOR updates + taste-matched
  new releases), optional real-time push for MAJOR updates to owned games, price-drop alerts,
  live "refresh now" proxy.

---

## 8. Scope discipline (YAGNI for v1)

**In for Phase A:** login, library/wishlist import, the four feeds, two-layer toggle filters,
update classification on owned/wishlist games, the locked visual design, snapshot history.

**Explicitly deferred:** global build-watcher (B), any notifications/digests (C), price-drop
alerts (C), social/sharing features, mobile-native app, multi-user accounts beyond "it
happens to work per-SteamID."

---

## 9. Open questions / risks

- **Steam store JSON endpoints are undocumented** - stable in practice but could change;
  collector should isolate each source so one breaking doesn't sink the others.
- **Update classification accuracy** - Steam's per-app news doesn't always carry a clean
  event-type; MAJOR vs UPDATE will lean on heuristics. Acceptable for v1; refine later.
- **Phase B (SteamKit2) is the real complexity** - deliberately out of v1.
- **Profile-privacy dependency** - library data needs a public profile; mitigated with a
  clear prompt, but it's a hard external constraint.
```
