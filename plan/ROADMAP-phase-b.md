# Steam Command Center - Phase B Roadmap

Derived from `docs/research-brief-steam-ecosystem.md` + the returned ecosystem research (14 Jun 2026).
Phase A (discovery, monitor, hero feed, login/import, deploy) is **DONE and live**. Phase B layers on price intelligence, per-game signals, a detail surface, achievements, alerting, and a composite "should I act today" digest.

**North star:** fuse *patch classification + review reaction + player momentum + price context* per owned game - the unclaimed niche no incumbent fills.

**Architecture invariant (unchanged):** the frontend never calls Steam/3rd-party live on page load. The Python collector writes snapshots to Postgres; the web reads only Postgres. Keep undocumented endpoints in the collector with jitter/backoff + descriptive User-Agent.

**Build order:** roughly by dependency + "felt value." Order isn't sacred - we just work top-to-bottom until done.

## 📅 SESSION 4 - 2026-06-15 (ITAD fix + health page + B12 feed, subagent-driven)
Merged to `master` (`b5d20ee`), pushed, Vercel auto-deployed. Collector **79 tests**, web **110 tests**, all green. Each task: impl + spec-review + code-quality-review subagents.
- **ITAD price refresh fixed** - `prices/v3` & `subs/v1` cap at 200 ids/request; collector sent up to 300 → universal HTTP 400 (site prices stale). `fetch_prices`/`fetch_subs` now chunk at `MAX_IDS_PER_REQUEST=200` + merge. `redact_key()` strips `key=` from `collector_health` detail strings (was leaking the API key into the DB). Verified live (300 ids → 258 rows).
- **Migration 0006 applied to Neon** - `collector_health` live; the open ⚠ is closed.
- **`/status` Collector Health page** - new web surface + STATUS nav tab; per-source ok/error, relative last-success/last-run, redacted detail. (Closes the "a UI surface for collector_health" open item.)
- **B12 feed surface** - "NEW BUILD #id" badge on the What's New feed for library games whose build changed ≤14d (`isRecentBuild`, Neon ISO-string-safe). Detail-page Builds + worker + `build_history` (1454 rows) were already live; B12's remainder is purely **operational** (run `pics_worker.py` on the VPS).

Still open after session 4: B12 operational (VPS worker uptime); OpenCritic deep-link (needs stored slug); new-release threshold re-tuning.

## 📅 SESSION 3 - 2026-06-15 (search + library browser + polish, subagent-driven)
Merged to `master` (`2bf3bcc`). Web **90 tests**, collector **72 tests**, all green. 5 features, each TDD'd + spec-reviewed + code-quality-reviewed via subagent-driven-development:
- **Game search** - search box in the TopNav header (plain GET form, no-JS) → `/search` → any game's `/game/[appid]`. `searchGames` + pure `rankSearchResults` (exact>prefix>substring, review_count tiebreak) in queries.ts. Scope: our `games` table only (detail page reads Postgres only).
- **My Games browser** - `/library` page + `LibraryBrowser` client component + `MY GAMES` nav tab (after MONITOR). Sortable owned+wishlist by hours / completion% / Deck tier / review / price; kind filter All/Owned/Wishlist. Pure `sortLibrary`/`filterByKind` in `lib/library.ts` (TDD).
- **Two-tier NEW RELEASES** - `splitNewReleaseTiers` (proven-good first, then promising) replaces the hard signal gate so the column has depth without surfacing slop. Junk + confidently-bad still dropped.
- **Web polish** - OpenCritic link-out on detail (`openCriticSearchUrl`, search-link since we don't store the slug; a11y aria-label); library-import delete+insert is now ATOMIC via `sql.transaction([...])` (neon HTTP driver) - no more empty-library-on-crash.
- **Collector health logging** - `collector_health` table (migration **0006**) + `StoreWriter.record_health` (last_success_at preserved on error) + per-source instrumentation in run.py (search/charts/calendar/itad_*/proton/deck/spy/hltb/review_trend/news). Exception-safe (never breaks a cycle). ⚠ **Apply migration 0006 to Neon** before the collector can write health rows (fails safe until then).

Remaining from prior "open" list: per-source health logging now DONE; library-import transactional now DONE; OpenCritic link-out now DONE; new-releases depth tuned. Still open: PICS watcher (B12/Phase C); optional new-release threshold re-tuning; OpenCritic deep-link (needs storing the slug); a UI surface for collector_health.

## 📅 SESSION 2 - 2026-06-15 PM (walkthrough fixes + polish + subagent-driven features)
All shipped & deployed to prod. Collector **70 tests**, web **65 tests**, all green.

**Walkthrough fixes:**
- Dashboard layout: feed game-name now `flex:1/minWidth:0` (was overflowing → monitor overlapped); grid cols get `minWidth:0`.
- Removed ProtonDB/Deck tier pills (platinum/gold/silver) from the dashboard (kept on detail + dedicated list pages).
- Filter toggles: removed `my_games`/`global` (they were no-ops, read by nothing); kept quality/taste (which filter the discovery columns).
- **B11 calendar REDONE properly:** real upcoming releases from OpenCritic's free `.ics` feed (`opencritic_cal.py`, TDD; `release_calendar` table, migration 0004; refreshed ~6h; name-matched to Steam ids). `/calendar` leads with dated upcoming (GTA VI, Halo: Campaign Evolved, …) grouped by month; wishlist coming-soon kept below. (Steam's "coming soon" is undated, hence the old 1-entry calendar.)
- Specials gap fixed: TOP SELLERS / SPECIALS column now includes `special` (getDiscovery accepts multiple categories).

**3 subagent-driven feature tasks (subagent-driven-development, sequential):**
- **Good New Releases:** `rankNewReleases` (TDD) - drops junk + confidently-bad, ranks by review-score×confidence + owners/critic. THEN sourced from **newest-by-release-date** (`fetch_new_releases`, store search `sort_by=Released_DESC&category1=998`, ~200 games; featuredcategories no longer emits new_release) + **hard quality filter** (keep only games with a real signal: ≥10 reviews & ≥65%, OR a critic score, OR ≥50k owners). Result: lean (~24/200) but genuinely-good recent indies (Capsule Lover, Melody's Escape 2, Tabletop Tavern…). Honest: column grows as fresh releases accrue reviews.
- **Digest dismiss + show-more:** ✕ per "Worth Your Attention" card → persisted in `dismissed_digest` (migration 0005), never resurfaces; "Show N more" pages all ~44 items. DigestStrip is now a client component.
- **Rich "What's New" feed:** feed cards rebuilt to Steam's format - game → bold headline + cleaned blurb (`blurb()` via stripBbcode, TDD) → prominent `−60% €X→€Y` deal line → OWNED/WISHLIST.

**OpenCritic investigation:** their REST API is paid (RapidAPI). We already get OpenCritic *scores* via ITAD (B6). The `.ics` calendar is free (now used). Possible add: link-out to the OpenCritic page on detail.

**Open / for tomorrow (2026-06-16):**
- New-releases column is lean now - tune the hard-filter thresholds, or revisit whether to also show promising no-review games. Trending still uses `popularnew`; could repurpose now that new_release is its own source.
- Bigger missing capabilities from the "what else" list: **search** (look up any game → /game/[appid]) and a **"My Games" library browser** (sortable by Deck/hours/completion/price) - both high-value, data already exists.
- Smaller: OpenCritic link-out on detail; library-import made transactional; per-source "last success" health logging.
- PICS watcher runs in a long-lived session on the host (re-enter email Guard code after a reboot); TOTP/systemd path is committed and ready if a phone authenticator is added to the watcher account.

## ✅ FOLLOW-UPS SHIPPED (2026-06-15, post-roadmap)
- **Subscription detection** (B3): `games.sub_names` via ITAD `/games/subs/v1`; "ON GAME PASS" badge + "play free" digest signal (106 games).
- **Player-count spike** (B9): owned games spiking surface in the digest.
- **Valve Deck rating** (B1): `games.deck_verified` via `ajaxgetdeckappcompatibilityreport`; "STEAM DECK ✓ Verified" on detail (467 rated). Complements ProtonDB.
- **HowLongToBeat hours** (B10): `howlongtobeat.py` (subagent-built, live-verified via the new `/api/bleed` honeypot flow); `games.hltb_*`; "TO BEAT ≈Nh" on detail + `/backlog` per-game hours + "~Xh to clear" total. Restores backlog budgeting.
- **™ → `�` name glitch**: already resolved (GetItems name backfill); 0 corrupted names.
- Still open (lower value): full per-achievement list w/ icons (GetSchemaForGame); bundle detection (`/games/bundles`).
- Collector 63 tests, web 45 tests, all green.

## ✅ PHASE B COMPLETE (2026-06-15) - B1–B11 all shipped & deployed
B1 Deck badge · B2 ownership · B3 price+ATL · B4 review momentum · B5 detail page · B6 critic scores · B7 achievements · B8 price-drop alerts · B9 "Worth Your Attention Today" digest · B10 Deck backlog · B11 coming-soon calendar. Collector 48 tests, web 43 tests, all green. Only **B12 (PICS patch diffing)** remains - a separate Phase C (needs SteamKit + a logged-in Steam account).

---

## External setup needed (one-time, by the maintainer)
- [ ] **ITAD API key** - register an app at https://isthereanydeal.com/apps/ → get the API key. Set `ITAD_API_KEY` in `collector/.env`, `web/.env.local`, Vercel env, and GitHub Actions secret. (Needed for B3, B6, B8, B9.)
- [ ] **ITAD OAuth app** (later, for B8 webhook) - same dashboard, register an OAuth client (PKCE), note client id + redirect.
- [ ] Confirm collector sets a descriptive `User-Agent` on all 3rd-party/undocumented calls (B0).

---

## B0 - Infra prep (no external deps)  ·  effort: S
- [ ] Add a shared `User-Agent` (e.g. `SteamCommandCenter/1.0 (+contact)`) to all collector HTTP clients + jitter/backoff helper.
- [ ] New migration `0002_phase_b.sql` scaffold (tables added per sprint below).
- [ ] `getGameSignals(appId)` query helper + a `signals` join pattern for the detail page.

## B1 - Steam Deck / Linux compatibility badge  ·  source: ProtonDB  ·  effort: S  ·  no key  ·  ✅ DONE (deployed)
- [x] Collector `proton_db.py`: fetch ProtonDB summary (tier/trending/confidence); 404→unrated. TDD.
- [x] Bounded backfill pass in `run_once`; `write_proton` + `app_ids_missing_proton`.
- [x] DB (migration 0002): `games.proton_tier/proton_trending_tier/proton_confidence/proton_checked_at`; RPC returns proton_tier.
- [x] UI: `DeckBadge` on discovery cards, game list, monitor, feed.
- [ ] (follow-up) Capture Valve **Deck Verified** status from `GetItems` platform data - deferred to detail page (B5).

## B2 - Ownership estimate + tag context  ·  source: SteamSpy  ·  effort: S  ·  no key  ·  ✅ DONE (deployed)
- [x] Collector `steam_spy.py` (parse+fetch, TDD); paced backfill (<=1 req/s) in run_once.
- [x] DB (0002): owners_estimate, spy_ccu, spy_avg_playtime, spy_tags jsonb, spy_checked_at. Writer write_spy + app_ids_missing_spy.
- [x] UI: `formatOwners` (TDD) → "~100M–200M owners" on discovery list pages.

## B3 - Price + all-time-low  ·  source: ITAD  ·  effort: M  ·  ✅ DONE (deployed)
- [x] Collector `itad.py`: batch appid→ITAD id (Steam shop 61) + batch `prices/v3` → cheapest current deal + historyLow.all (TDD). Bounded refresh in run_once (12h staleness).
- [x] DB (0002): games.itad_id/itad_price_cents/itad_atl_cents/itad_cut/itad_shop/itad_currency/itad_checked_at. Writer stale_itad_targets + write_itad_prices.
- [x] UI: `PriceTag` ("€X −Y%  ◀ all-time low!") on feed cards, list pages, detail page. ITAD_API_KEY in all envs. Backfilled 1134 games (95 at ATL).
- [ ] (follow-up) bundle/subscription detection (`games/bundles`/`subs`) - quick add to B3.

## B4 - Review-momentum overlay  ·  source: appreviewhistogram  ·  effort: M  ·  no key  ·  ✅ DONE (deployed)
- [x] Collector `review_histogram.py`: recent (30d) vs lifetime sentiment → recent_pct + up/down/flat trend (TDD). Bounded refresh pass.
- [x] DB (0002): recent_review_pct, review_trend, recent_review_up/down, review_hist_checked_at. Writer write_review_trend + app_ids_stale_review_trend.
- [x] UI: `ReviewTrend` badge ("REV 64% ▲/▼") on feed game cards + discovery list pages.
- [ ] (follow-up) Tie the trend to a specific patch's date ("reviews ↓ since this update") - needs per-patch correlation; folds into B9 digest.

## B5 - Game detail page `/game/[appid]`  ·  effort: M  ·  foundational  ·  ✅ DONE (deployed)
- [x] Route composing: hero (thumb/name/Deck/review-trend/owned badge), stats (price/reviews/players-now/owner-est/avg-playtime), tags, Steam link, full classified update history (cleaned bodies). `getGameDetail` query.
- [x] Cards + feed titles link to `/game/[appid]`; "Open in Steam ↗" on the detail page.
- [ ] (slots reserved) price/ATL chart (B3), HLTB/OpenCritic (B6), achievements (B7) - add as those land.

## B6 - Critic scores (Metacritic + OpenCritic) on detail page  ·  source: ITAD  ·  effort: S  ·  ✅ DONE (deployed)
- [x] Collector `parse_game_info`/`fetch_game_info` from stable `/games/info/v2` reviews (Metacritic critic+user, OpenCritic) (TDD). Bounded pass; migration 0002 cols; writer stale_critic_targets + write_critic.
- [x] Detail page METACRITIC / OPENCRITIC color-graded stats.
- ⚠ **HLTB unavailable:** ITAD `/internal/hltb` returns 403 "insufficient permissions" on our key tier. HowLongToBeat hours need a different source (unofficial HLTB search API) - see B10.

## B7 - Achievements progress + near-completion nudges  ·  source: official Web API  ·  effort: M  ·  uses our key  ·  ✅ DONE (deployed)
- [x] web `achievements` lib: GetPlayerAchievements + GetGlobalAchievementPercentages → per-game summary (achieved/total/pct, last_unlock, rarest unlocked). `summarizeAchievements` TDD.
- [x] Import route syncs summaries for top-40 owned games → `user_game_achievements` (migration 0002).
- [x] UI: detail-page "Your Achievements" (progress bar, near-100%, rarest); `AchievementBadge` ("ACH N from 100%") on feed cards.
- [ ] (follow-up) full per-achievement list w/ icons on detail page (needs GetSchemaForGame cache) - nice-to-have.

## B8 - Price-drop alerts  ·  effort: M  ·  ✅ DONE (deployed, in-app pull approach)
- [x] `detect_price_drops` (TDD): compares fresh ITAD prices to previously-stored ones; genuine decreases recorded in `price_drops` (at_atl flag). Wired into the run_once price pass. Migration 0002 + writer current_prices/record_price_drops.
- [x] `getPriceDrops` (wishlist, last 7 days) + "⬇ Price Drops · Your Wishlist" strip at top of dashboard. Fills going forward as the cron catches drops.
- DECISION: chose in-app pull alerts over the ITAD OAuth push-webhook (no redirect-URI setup / consent flow needed; reuses existing polling). The OAuth push variant remains a future option if external (email/Telegram) push is wanted.

## B9 - "Should I act today" composite digest  ·  effort: M  ·  ✅ DONE (deployed)
- [x] `buildDigest` (TDD) fuses signals, gated by ownership: wishlist→all-time-low (buy); owned→near-100% achievements + fresh MAJOR/HOTFIX patch (≤2 days). Dropped noisy perpetual-sale signal.
- [x] `getActionDigest(steamId)` query; `DigestStrip` "★ Worth Your Attention Today" at top of dashboard. ~44 actionable items, top 12 by score.
- [ ] (follow-up) add player-count spike + bundle/sub signals once collected.

## B10 - Deck backlog  ·  effort: M  ·  ✅ DONE (deployed)
- [x] `rankBacklog` (TDD): OWNED + barely-played (<120m) + Deck-ready (platinum/gold), ranked by best of Steam%/OpenCritic/Metacritic.
- [x] `getBacklog` query + `/backlog` page + BACKLOG nav tab.
- [ ] Optional later: unofficial HowLongToBeat search API for hour estimates → true "finishable this month" budgeting.

## B11 - Release calendar (Coming Soon wishlist)  ·  effort: M  ·  no key  ·  ✅ DONE (deployed)
- [x] Collector parse_appdetails captures coming_soon + release_date (TDD); upsert_games stores them; migration 0002.
- [x] `getReleaseCalendar` (wishlist coming-soon; dated first then TBA) + `/calendar` page + CALENDAR nav tab.
- NOTE: most upcoming games only expose "Coming soon" (no concrete date) via Steam, so dated entries sort first and the rest fall under TBA - a true month grid isn't possible from Steam's data.

## B12 (Phase C, ambitious) - PICS patch/depot diffing  ·  effort: XL  ·  separate worker
- [ ] Standalone worker using SteamKit / node-steam-user (logged-in Steam account) to read PICS changelog → real build IDs + depot diffs (SteamDB's crown jewel).
- [ ] DB: `build_history` (app_id, build_id, changed_at, depots).
- [ ] UI: "new build #N" on detail page + feed; true patch-diff fidelity. **Only if we want this badly** - highest effort, needs a Steam account + long-running connection.

---

## Explicitly out of scope
Gamalytic / VG Insights (paid, not personal-use licensed) · AllKeyShop (grey-market/ToS) · scraping SteamDB (forbidden) · CheapShark in the collector (bulk-cache → permanent block; on-demand-from-browser-with-redirect-links only, if ever).

## Cross-cutting ToS / safety rules
- ITAD: keep affiliate tags + links, ≤1000 req/5min, internal/unstable endpoints get fallbacks.
- Undocumented store endpoints (`appreviewhistogram`, RSS, `appdetails`): collector-only, jitter/backoff, descriptive UA, never on page load.
- Never expose our Steam Web API key or ITAD key client-side.
