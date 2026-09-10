# Research Brief - Steam Tooling Ecosystem & Data Sources

## Your role
You are a research analyst surveying the ecosystem of Steam-related websites, tools, and data sources. Your output will directly feed the roadmap of a personal Steam "command center" web app. Be concrete, current, and actionable - favor things we can actually build or plug into over generic observations.

## What we're building (context)
A personal daily-glance dashboard for staying on top of Steam (internal name "Steam Command Center"). Current features:
- **New releases / Trending / Top sellers** columns (from Steam's store featured + search endpoints).
- **Monitor** - live most-played leaderboard with player counts + short-term momentum (sourced from Steam's official `GetMostPlayedGames` + `GetNumberOfCurrentPlayers`).
- **Recently Updated feed** - the hero feature: a classified (MAJOR / UPDATE / HOTFIX / CONTENT) news feed scoped to the signed-in user's **owned + wishlist** games (Steam OpenID login + library import).

Stack: Next.js frontend (Vercel) + a Python collector (GitHub Actions cron) writing snapshots into Postgres. Architecture rule: the frontend never calls Steam live on page load - a background collector writes snapshots, so everything is cheap and ban-safe. Aesthetic is deliberately retro (2003-era Steam).

We already use these Steam endpoints: store `featuredcategories`, store `search/results` (filter=popularnew/topsellers), `appdetails`, `appreviews`, `ISteamNews/GetNewsForApp`, `ISteamUserStats/GetNumberOfCurrentPlayers`, `ISteamChartsService/GetMostPlayedGames`, `IPlayerService/GetOwnedGames`, `IWishlistService/GetWishlist`, `IStoreBrowseService/GetItems`, Steam OpenID.

## Objective
Catalogue the Steam-tooling landscape and the data sources behind it, so we can (a) discover features worth adding, and (b) find APIs/feeds we can integrate. Two deliverables matter most: a **feature catalogue** (what others do well) and a **data-source/API catalogue** (what we can plug into).

## Scope - sites & tools to survey
Start from these seeds and expand to anything comparable you find (forums, GitHub, ProductHunt, subreddits like r/Steam, r/SteamDeck):
- **Stat / charts / database:** SteamDB (steamdb.info), Steam Charts (steamcharts.com), Gamalytic, VG Insights, SteamSpy, Steam250.
- **Browser augmentation:** Augmented Steam, SteamDB extension, Enhanced Steam (legacy).
- **Deals / price tracking:** IsThereAnyDeal, SteamDB sales, GG.deals, AllKeyShop, CheapShark (API).
- **Reviews / curation:** Steam250, ProtonDB (Linux/Deck compatibility), Steam Deck verified trackers.
- **Library / backlog / social:** Steam Gauge, Astats, Backloggd, Lutris/Playnite (clients), Steam Hunters (achievements), Completionist.me.
- **Wishlist / release tracking:** wishlist notifiers, release calendars, Steam Next Fest trackers.
- **Anything adjacent** you discover that a power user actually relies on.

## For each site/tool, capture
- Name + URL, and what it's for in one line.
- **Standout features** - the 2–5 things it does that users love or that we don't have. Be specific (e.g. "shows full price history with per-store lows", "depot/patch diff history", "concurrent-player history charts going back years").
- **Underlying data sources** - where does it get its data? (official Steam Web API, undocumented store endpoints, scraping, partner feeds, community submissions, its own crawler.)
- **Does it expose an API / data feed / export we could consume?** If yes: endpoint(s), auth model, rate limits, cost, ToS constraints, data freshness. This is the highest-value information - flag it prominently.
- **Borrowability** - could we replicate or integrate the feature given our stack and the Steam endpoints we already use? Rough effort (easy / medium / hard) and what data it would need.

## Specifically hunt for (APIs & feeds)
- Official Steam Web API methods we're **not** yet using that could power new features (e.g. achievements, app lists/changes, depot/build info, review histograms, package/price info, Steam Deck compatibility, news by tag/region).
- Undocumented but stable store endpoints (the kind SteamDB/Augmented Steam rely on).
- Third-party APIs with free tiers: **CheapShark** (deals), **IsThereAnyDeal API** (price history/waitlist), **ProtonDB** (compat), **SteamSpy API** (ownership estimates), **Gamalytic / VG Insights** (sales estimates - note if paid), RSS/Atom feeds (Steam news/blog, individual app news feeds).
- Any webhook/push or RSS option that avoids polling.
For every API: note auth (key? OAuth? none), rate limits, cost/free tier, and ToS gotchas (especially anything that forbids redistribution or commercial use).

## Deliverable format
1. **Feature catalogue** - a table: Site | Category | Standout features | Data source | Has API? | Borrowability (effort) | Notes.
2. **Data-source / API catalogue** - a table: Source | What it provides | Auth | Rate limit | Cost | Freshness | ToS notes | How we'd use it.
3. **Top 10 feature recommendations for our app**, ranked, each with: what it is, which site does it best, the data source/API needed, rough effort, and why it fits a personal daily-glance dashboard (vs. a pro analytics tool).
4. **Gaps & opportunities** - things no existing tool does well that we could own.
5. A short **"watch out" list** - ToS/rate-limit/ban risks, deprecated endpoints, anything that bit other builders.

## Constraints & guidance
- Prioritize **free / public / personal-use-friendly** sources; clearly flag anything paid or commercially restricted.
- Prefer **integratable** findings (an API, a feed, a stable endpoint) over things that require heavy scraping - but note the scraping approach if that's the only way and it's what the incumbents do.
- Favor **current** info (endpoints and rate limits change); note last-verified dates and link sources.
- Keep our context in mind: single-user dashboard, snapshot-based architecture, ban-safety matters. We care about breadth of useful signals (prices, patch diffs, achievements, compat, sales/ownership estimates, release calendars) more than enterprise analytics.
- Cite sources/links for every claim so we can verify.
