"""One-time backfill of the hover-card detail fields for existing games.

Re-runs appdetails enrichment for every game that hasn't had its card details captured.
Reads collector/.env for DATABASE_URL + keys. Run once after migration 0008:
    cd collector && python backfill_card_details.py
"""
import time
import httpx
import psycopg
from steam_collector.config import DATABASE_URL
from steam_collector.steam_catalog import enrich_game
from steam_collector.store_writer import StoreWriter


def main() -> None:
    # Neon closes a connection left idle across the slow per-game HTTP enrich,
    # so process in rounds: (re)connect, drain remaining targets, and on a
    # dropped connection reconnect and resume. `attempted` (appids we've either
    # enriched or that returned no appdetails) guarantees termination even when
    # some apps are delisted/unenrichable and would otherwise reappear forever.
    attempted: set[int] = set()
    enriched = 0
    with httpx.Client(timeout=20.0) as http:
        while True:
            conn = psycopg.connect(DATABASE_URL, autocommit=True)
            writer = StoreWriter(conn)
            targets = [a for a in writer.detail_targets() if a not in attempted]
            if not targets:
                conn.close()
                break
            print(f"connecting; {len(targets)} games left to attempt")
            try:
                for app_id in targets:
                    try:
                        row = enrich_game(http, app_id)
                    except Exception:
                        row = None
                    if row is None:
                        attempted.add(app_id)  # unenrichable; don't retry it
                        time.sleep(0.3)
                        continue
                    writer.upsert_games([row])  # may raise on a dropped connection
                    attempted.add(app_id)
                    enriched += 1
                    if enriched % 50 == 0:
                        print(f"  enriched {enriched}")
                    time.sleep(0.3)  # be gentle with the store endpoint
            except psycopg.OperationalError as exc:
                print(f"  connection dropped ({exc!s}); reconnecting and resuming")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass
    print(f"done: {enriched} enriched this run")


if __name__ == "__main__":
    main()
