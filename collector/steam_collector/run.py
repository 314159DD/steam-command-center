import os
import time
import httpx
import psycopg
from steam_collector.config import DATABASE_URL, COLLECT_INTERVAL_SECONDS, ITAD_API_KEY, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
from steam_collector.itad import lookup_itad_ids, fetch_prices, fetch_game_info, detect_price_drops, fetch_subs, fetch_bundles, redact_key
from steam_collector.igdb import get_igdb_token, fetch_igdb
from steam_collector.steam_store import fetch_featured
from steam_collector.steam_trending import fetch_trending, fetch_top_sellers, fetch_new_releases
from steam_collector.steam_charts import fetch_most_played
from steam_collector.proton_db import fetch_proton_summary
from steam_collector.deck_compat import fetch_deck_compat
from steam_collector.steam_spy import fetch_spy_appdetails
from steam_collector.review_histogram import fetch_review_histogram
from steam_collector.howlongtobeat import fetch_hltb
from steam_collector.opencritic_cal import fetch_calendar
from steam_collector.steam_players import fetch_player_count
from steam_collector.steam_news import fetch_news
from steam_collector.classifier import classify
from steam_collector.store_writer import StoreWriter
from steam_collector.steam_catalog import enrich_game


def _record(writer, source, ok, detail=""):
    try:
        writer.record_health(source, ok, redact_key(str(detail)))
    except Exception:
        pass  # health logging must never break a collection cycle


def run_once(writer: StoreWriter, http: httpx.Client | None) -> None:
    own_http = http is None
    http = http or httpx.Client(timeout=20.0)
    try:
        writer.write_discovery(fetch_featured(http))

        # 'New & Trending', 'Top Sellers', and newest-by-release-date all live
        # behind a separate search endpoint; isolate failures so a throttled
        # search can't drop the rest of the cycle. NEW RELEASES is sourced here
        # (newest by date) rather than from featuredcategories.
        try:
            writer.write_discovery(fetch_trending(http))
            writer.write_discovery(fetch_top_sellers(http))
            writer.write_discovery(fetch_new_releases(http))
            _record(writer, "search", True, "trending+top_sellers+new_releases ok")
        except Exception as exc:
            print(f"[collector] search fetch failed: {exc}")
            _record(writer, "search", False, str(exc))

        # Register the globally most-played games so they get enriched + polled
        # for live counts (otherwise CS2/Dota2/PUBG never appear in the monitor).
        try:
            chart = fetch_most_played(http)[:30]
            writer.ensure_apps([r["app_id"] for r in chart])
            _record(writer, "charts", True, f"{len(chart)} apps")
        except Exception as exc:
            print(f"[collector] most-played chart fetch failed: {exc}")
            _record(writer, "charts", False, str(exc))

        # OpenCritic release calendar (global feed; refresh at most ~every 6h).
        try:
            if not writer.calendar_fresh():
                events = fetch_calendar(http)
                writer.replace_release_calendar(events)
                _record(writer, "calendar", True, f"{len(events)} events")
            else:
                _record(writer, "calendar", True, "fresh, skipped")
        except Exception as exc:
            print(f"[collector] OpenCritic calendar refresh failed: {exc}")
            _record(writer, "calendar", False, str(exc))

        # Enrich catalog so quality/taste filters have tags + reviews to work with.
        enriched = []
        for app_id in writer.app_ids_missing_tags():
            try:
                row = enrich_game(http, app_id)
            except Exception:
                row = None
            if row is not None:
                enriched.append(row)
        writer.upsert_games(enriched)

        # Card-detail backfill: re-enrich games missing the hover-card fields (developer,
        # VAC/family-sharing, trailer id, screenshots). Bounded; new games already get these
        # via the missing-tags pass above. enrich_game returns the same row shape.
        detail_rows = []
        for app_id in writer.detail_targets()[:60]:
            try:
                row = enrich_game(http, app_id)
            except Exception:
                row = None
            if row is not None:
                detail_rows.append(row)
        writer.upsert_games(detail_rows)
        _record(writer, "details", True, f"{len(detail_rows)} enriched")

        app_ids = writer.tracked_app_ids()
        # tracked_app_ids unions user_libraries, which can include wishlist apps
        # that have no games row yet. player_counts/updates FK games(app_id), so
        # register any missing ones before polling to avoid a FK violation crash.
        writer.ensure_apps(app_ids)

        counts = []
        for app_id in app_ids:
            try:
                pc = fetch_player_count(http, app_id)
            except Exception:
                pc = None
            if pc is not None:
                counts.append({"app_id": app_id, "player_count": pc})
        writer.write_player_counts(counts)

        # ProtonDB / Steam Deck compat backfill (bounded per cycle; undocumented
        # endpoint, so be gentle). None (404) marks the app 'unrated' so we don't refetch.
        proton_targets = writer.app_ids_missing_proton()[:150]
        proton_ok = 0
        for app_id in proton_targets:
            try:
                data = fetch_proton_summary(http, app_id)
            except Exception:
                continue
            writer.write_proton(app_id, data)
            proton_ok += 1
        _record(writer, "proton", True, f"{proton_ok} ok / {len(proton_targets)} attempted")

        # Valve official Steam Deck rating (Verified/Playable/Unsupported); bounded.
        deck_targets = writer.app_ids_missing_deck()[:120]
        deck_ok = 0
        for app_id in deck_targets:
            try:
                label = fetch_deck_compat(http, app_id)
            except Exception:
                continue
            writer.write_deck(app_id, label)
            deck_ok += 1
        _record(writer, "deck", True, f"{deck_ok} ok / {len(deck_targets)} attempted")

        # SteamSpy ownership backfill (bounded; SteamSpy asks for <=1 req/s).
        spy_targets = writer.app_ids_missing_spy()[:40]
        spy_ok = 0
        for app_id in spy_targets:
            try:
                spy = fetch_spy_appdetails(http, app_id)
            except Exception:
                continue
            writer.write_spy(app_id, spy)
            spy_ok += 1
            time.sleep(1.1)
        _record(writer, "spy", True, f"{spy_ok} ok / {len(spy_targets)} attempted")

        # HowLongToBeat hours (name-matched, fragile honeypot API; bounded + gentle).
        hltb_targets = writer.hltb_targets()[:25]
        hltb_ok = 0
        for app_id, name in hltb_targets:
            try:
                hltb = fetch_hltb(http, name)
            except Exception:
                continue
            writer.write_hltb(app_id, hltb)
            hltb_ok += 1
            time.sleep(0.4)
        _record(writer, "hltb", True, f"{hltb_ok} ok / {len(hltb_targets)} attempted")

        # Review-momentum backfill/refresh (bounded; undocumented store endpoint).
        review_targets = writer.app_ids_stale_review_trend()[:60]
        review_ok = 0
        for app_id in review_targets:
            try:
                rh = fetch_review_histogram(http, app_id)
            except Exception:
                continue
            writer.write_review_trend(app_id, rh)
            review_ok += 1
        _record(writer, "review_trend", True, f"{review_ok} ok / {len(review_targets)} attempted")

        # IGDB (Twitch) anticipation + critic signals for recent releases (bounded).
        if TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET:
            try:
                igdb_targets = writer.igdb_targets()[:200]
                matched = 0
                if igdb_targets:
                    token = get_igdb_token(http, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)
                    data_by_app = fetch_igdb(http, TWITCH_CLIENT_ID, token, igdb_targets)
                    for app_id in igdb_targets:
                        writer.write_igdb(app_id, data_by_app.get(app_id))
                    matched = len(data_by_app)
                _record(writer, "igdb", True, f"{matched} matched / {len(igdb_targets)} attempted")
            except Exception as exc:
                print(f"[collector] IGDB refresh failed: {exc}")
                _record(writer, "igdb", False, str(exc))

        # ITAD price + all-time-low refresh (batched; resolve missing ids then one prices call).
        if ITAD_API_KEY:
            try:
                targets = writer.stale_itad_targets()[:300]
                id_by_app = {app: iid for app, iid in targets}
                missing = [app for app, iid in targets if not iid]
                if missing:
                    id_by_app.update(lookup_itad_ids(http, ITAD_API_KEY, missing))
                ids = sorted({iid for iid in id_by_app.values() if iid})
                prices = fetch_prices(http, ITAD_API_KEY, ids) if ids else {}
                subs = fetch_subs(http, ITAD_API_KEY, ids) if ids else {}
                price_rows = [
                    {"app_id": app, "itad_id": iid, "sub_names": subs.get(iid) or [], **(prices.get(iid) or {})}
                    for app, iid in id_by_app.items()
                ]
                # Detect drops vs the previously-stored prices before overwriting them.
                old = writer.current_prices([r["app_id"] for r in price_rows])
                writer.record_price_drops(detect_price_drops(old, price_rows))
                writer.write_itad_prices(price_rows)
                _record(writer, "itad_prices", True, f"{len(price_rows)} rows")
            except Exception as exc:
                print(f"[collector] ITAD price refresh failed: {exc}")
                _record(writer, "itad_prices", False, str(exc))

            # Critic scores (Metacritic/OpenCritic) via per-game info; bounded.
            try:
                critic_targets = writer.stale_critic_targets()[:80]
                critic_ok = 0
                for app_id, itad_id in critic_targets:
                    try:
                        info = fetch_game_info(http, ITAD_API_KEY, itad_id)
                    except Exception:
                        continue
                    writer.write_critic(app_id, info)
                    critic_ok += 1
                _record(writer, "itad_critic", True, f"{critic_ok} ok / {len(critic_targets)} attempted")
            except Exception as exc:
                print(f"[collector] ITAD critic refresh failed: {exc}")
                _record(writer, "itad_critic", False, str(exc))

            # Active-bundle detection (per-game GET; bounded).
            try:
                bundle_targets = writer.bundle_targets()[:80]
                bundle_ok = 0
                for app_id, itad_id in bundle_targets:
                    try:
                        writer.write_bundle(app_id, fetch_bundles(http, ITAD_API_KEY, itad_id))
                    except Exception:
                        continue
                    bundle_ok += 1
                _record(writer, "itad_bundles", True, f"{bundle_ok} ok / {len(bundle_targets)} attempted")
            except Exception as exc:
                print(f"[collector] ITAD bundle refresh failed: {exc}")
                _record(writer, "itad_bundles", False, str(exc))

        updates = []
        news_ok = 0
        for app_id in app_ids:
            try:
                for it in fetch_news(http, app_id, count=5):
                    it["classification"] = classify(it["title"], it["body"])
                    updates.append(it)
                news_ok += 1
            except Exception:
                continue
        writer.write_updates(updates)
        _record(writer, "news", True, f"{news_ok} ok / {len(app_ids)} attempted")
    finally:
        if own_http:
            http.close()


def _connect():
    conn = psycopg.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def run_once_cli() -> None:
    """One cycle then exit (used by the GitHub Actions cron)."""
    conn = _connect()
    try:
        run_once(writer=StoreWriter(conn), http=None)
    finally:
        conn.close()


def main() -> None:
    if os.environ.get("RUN_ONCE"):
        run_once_cli()
        return
    conn = _connect()
    writer = StoreWriter(conn)
    while True:
        try:
            run_once(writer=writer, http=None)
        except Exception as exc:
            print(f"[collector] run failed: {exc}")
        time.sleep(COLLECT_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
