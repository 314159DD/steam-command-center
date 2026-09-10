"""Write normalized rows into Postgres via a psycopg connection."""
import json


class StoreWriter:
    def __init__(self, conn):
        self.conn = conn

    def write_discovery(self, rows: list[dict]) -> None:
        if not rows:
            return
        with self.conn.cursor() as cur:
            cur.executemany(
                """insert into games (app_id, name, header_image, price_cents)
                   values (%(app_id)s, %(name)s, %(header_image)s, %(price_cents)s)
                   on conflict (app_id) do update set
                     name = excluded.name,
                     header_image = excluded.header_image,
                     price_cents = excluded.price_cents,
                     updated_at = now()""",
                [{"app_id": r["app_id"], "name": r["name"],
                  "header_image": r.get("header_image"), "price_cents": r.get("price_cents")}
                 for r in rows],
            )
            cur.executemany(
                "insert into app_snapshots (app_id, category, rank) values (%(app_id)s, %(category)s, %(rank)s)",
                [{"app_id": r["app_id"], "category": r["category"], "rank": r.get("rank")} for r in rows],
            )

    def upsert_games(self, rows: list[dict]) -> None:
        if not rows:
            return
        with self.conn.cursor() as cur:
            cur.executemany(
                """insert into games (app_id, name, header_image, tags, genres,
                                      review_score, review_count, price_cents, is_released,
                                      coming_soon, release_date, released_at, developer, has_vac,
                                      family_sharing, trailer_movie_id, screenshots,
                                      details_checked_at, updated_at)
                   values (%(app_id)s, %(name)s, %(header_image)s, %(tags)s, %(genres)s,
                           %(review_score)s, %(review_count)s, %(price_cents)s, %(is_released)s,
                           %(coming_soon)s, %(release_date)s, %(released_at)s, %(developer)s, %(has_vac)s,
                           %(family_sharing)s, %(trailer_movie_id)s, %(screenshots)s,
                           now(), now())
                   on conflict (app_id) do update set
                     name = excluded.name, header_image = excluded.header_image,
                     tags = excluded.tags, genres = excluded.genres,
                     review_score = excluded.review_score, review_count = excluded.review_count,
                     price_cents = excluded.price_cents, is_released = excluded.is_released,
                     coming_soon = excluded.coming_soon, release_date = excluded.release_date,
                     released_at = excluded.released_at, developer = excluded.developer,
                     has_vac = excluded.has_vac, family_sharing = excluded.family_sharing,
                     trailer_movie_id = excluded.trailer_movie_id, screenshots = excluded.screenshots,
                     details_checked_at = now(), updated_at = now()""",
                [{"app_id": r["app_id"], "name": r.get("name", ""), "header_image": r.get("header_image"),
                  "tags": r.get("tags", []), "genres": r.get("genres", []),
                  "review_score": r.get("review_score"), "review_count": r.get("review_count"),
                  "price_cents": r.get("price_cents"), "is_released": r.get("is_released", True),
                  "coming_soon": r.get("coming_soon", False), "release_date": r.get("release_date"),
                  "released_at": r.get("released_at"), "developer": r.get("developer"),
                  "has_vac": r.get("has_vac"), "family_sharing": r.get("family_sharing"),
                  "trailer_movie_id": r.get("trailer_movie_id"),
                  "screenshots": json.dumps(r.get("screenshots") or [])}
                 for r in rows],
            )

    def write_player_counts(self, counts: list[dict]) -> None:
        if not counts:
            return
        with self.conn.cursor() as cur:
            cur.executemany(
                "insert into player_counts (app_id, player_count) values (%(app_id)s, %(player_count)s)",
                counts,
            )

    def write_updates(self, items: list[dict]) -> None:
        if not items:
            return
        with self.conn.cursor() as cur:
            cur.executemany(
                """insert into updates (gid, app_id, title, body, url, classification, posted_at)
                   values (%(gid)s, %(app_id)s, %(title)s, %(body)s, %(url)s, %(classification)s, %(posted_at)s)
                   on conflict (gid) do update set
                     title = excluded.title, body = excluded.body, url = excluded.url,
                     classification = excluded.classification, posted_at = excluded.posted_at""",
                items,
            )

    def ensure_apps(self, app_ids: list[int]) -> None:
        """Register app ids so they get enriched (name/image) and polled. Won't clobber existing rows."""
        if not app_ids:
            return
        with self.conn.cursor() as cur:
            cur.executemany(
                "insert into games (app_id, name) values (%(app_id)s, '') on conflict (app_id) do nothing",
                [{"app_id": a} for a in app_ids],
            )

    def write_proton(self, app_id: int, data: dict | None) -> None:
        """Store ProtonDB compat for an app; None (no reports) marks it 'unrated' so we don't refetch."""
        with self.conn.cursor() as cur:
            if data:
                cur.execute(
                    """update games set proton_tier = %s, proton_trending_tier = %s,
                       proton_confidence = %s, proton_checked_at = now() where app_id = %s""",
                    (data.get("tier"), data.get("trending_tier"), data.get("confidence"), app_id),
                )
            else:
                cur.execute(
                    "update games set proton_tier = 'unrated', proton_checked_at = now() where app_id = %s",
                    (app_id,),
                )

    def app_ids_missing_proton(self) -> list[int]:
        with self.conn.cursor() as cur:
            cur.execute("select app_id from games where proton_checked_at is null")
            return [row[0] for row in cur.fetchall()]

    def write_deck(self, app_id: int, label: str | None) -> None:
        """Valve Deck rating; None marks it checked (unknown) so we don't refetch."""
        with self.conn.cursor() as cur:
            cur.execute("update games set deck_verified = %s, deck_checked_at = now() where app_id = %s", (label, app_id))

    def app_ids_missing_deck(self) -> list[int]:
        with self.conn.cursor() as cur:
            cur.execute("select app_id from games where deck_checked_at is null")
            return [row[0] for row in cur.fetchall()]

    def write_spy(self, app_id: int, data: dict | None) -> None:
        """Store SteamSpy ownership/tags for an app. None marks it checked so we don't refetch."""
        import json
        with self.conn.cursor() as cur:
            if data:
                cur.execute(
                    """update games set owners_estimate = %s, spy_ccu = %s, spy_avg_playtime = %s,
                       spy_tags = %s, spy_checked_at = now() where app_id = %s""",
                    (data.get("owners"), data.get("ccu"), data.get("avg_playtime"),
                     json.dumps(data.get("tags") or {}), app_id),
                )
            else:
                cur.execute("update games set spy_checked_at = now() where app_id = %s", (app_id,))

    def app_ids_missing_spy(self) -> list[int]:
        with self.conn.cursor() as cur:
            cur.execute("select app_id from games where spy_checked_at is null")
            return [row[0] for row in cur.fetchall()]

    def write_hltb(self, app_id: int, data: dict | None) -> None:
        with self.conn.cursor() as cur:
            d = data or {}
            cur.execute(
                "update games set hltb_main = %s, hltb_extra = %s, hltb_completionist = %s, hltb_checked_at = now() where app_id = %s",
                (d.get("main"), d.get("extra"), d.get("completionist"), app_id))

    def hltb_targets(self) -> list[tuple]:
        """(app_id, name) for library+discovery games without HLTB hours yet (name-matched)."""
        with self.conn.cursor() as cur:
            cur.execute(
                """select app_id, name from games
                   where hltb_checked_at is null and name <> ''
                     and app_id in (select app_id from user_libraries union select app_id from app_snapshots)""")
            return cur.fetchall()

    def write_review_trend(self, app_id: int, data: dict | None) -> None:
        with self.conn.cursor() as cur:
            if data:
                cur.execute(
                    """update games set recent_review_pct = %s, review_trend = %s,
                       recent_review_up = %s, recent_review_down = %s, review_hist_checked_at = now()
                       where app_id = %s""",
                    (data.get("recent_pct"), data.get("trend"),
                     data.get("recent_up"), data.get("recent_down"), app_id),
                )
            else:
                cur.execute("update games set review_hist_checked_at = now() where app_id = %s", (app_id,))

    def app_ids_stale_review_trend(self) -> list[int]:
        """Library + discovery apps whose review trend is unset or older than ~a day."""
        with self.conn.cursor() as cur:
            cur.execute(
                """select app_id from games
                   where (review_hist_checked_at is null or review_hist_checked_at < now() - interval '20 hours')
                     and app_id in (select app_id from user_libraries union select app_id from app_snapshots)""")
            return [row[0] for row in cur.fetchall()]

    def stale_itad_targets(self) -> list[tuple]:
        """(app_id, itad_id) for tracked apps whose price is unset or >12h old."""
        with self.conn.cursor() as cur:
            cur.execute(
                """select app_id, itad_id from games
                   where (itad_checked_at is null or itad_checked_at < now() - interval '12 hours')
                     and app_id in (select app_id from user_libraries union select app_id from app_snapshots)""")
            return cur.fetchall()

    def current_prices(self, app_ids: list[int]) -> dict:
        """{app_id: (itad_price_cents, itad_atl_cents)} for the given apps."""
        if not app_ids:
            return {}
        with self.conn.cursor() as cur:
            cur.execute("select app_id, itad_price_cents, itad_atl_cents from games where app_id = any(%s)", (app_ids,))
            return {row[0]: (row[1], row[2]) for row in cur.fetchall()}

    def record_price_drops(self, drops: list[dict]) -> None:
        if not drops:
            return
        with self.conn.cursor() as cur:
            cur.executemany(
                "insert into price_drops (app_id, old_cents, new_cents, at_atl) values (%(app_id)s, %(old_cents)s, %(new_cents)s, %(at_atl)s)",
                drops,
            )

    def write_itad_prices(self, rows: list[dict]) -> None:
        """rows: {app_id, itad_id, price_cents, atl_cents, cut, shop, currency}."""
        if not rows:
            return
        with self.conn.cursor() as cur:
            cur.executemany(
                """update games set itad_id = %(itad_id)s, itad_price_cents = %(price_cents)s,
                   itad_atl_cents = %(atl_cents)s, itad_cut = %(cut)s, itad_shop = %(shop)s,
                   itad_currency = %(currency)s, sub_names = %(sub_names)s, itad_checked_at = now()
                   where app_id = %(app_id)s""",
                [{"itad_id": r.get("itad_id"), "price_cents": r.get("price_cents"),
                  "atl_cents": r.get("atl_cents"), "cut": r.get("cut"), "shop": r.get("shop"),
                  "currency": r.get("currency"), "sub_names": r.get("sub_names"), "app_id": r["app_id"]} for r in rows],
            )

    def stale_critic_targets(self) -> list[tuple]:
        """(app_id, itad_id) for tracked apps with an itad_id but no critic scores yet."""
        with self.conn.cursor() as cur:
            cur.execute(
                """select app_id, itad_id from games
                   where itad_id is not null and critic_checked_at is null
                     and app_id in (select app_id from user_libraries union select app_id from app_snapshots)""")
            return cur.fetchall()

    def write_bundle(self, app_id: int, data: dict) -> None:
        with self.conn.cursor() as cur:
            cur.execute("update games set bundle_count = %s, bundle_name = %s, bundle_checked_at = now() where app_id = %s",
                        (data.get("count"), data.get("name"), app_id))

    def bundle_targets(self) -> list[tuple]:
        """(app_id, itad_id) for tracked apps whose bundles are unset or >24h old."""
        with self.conn.cursor() as cur:
            cur.execute(
                """select app_id, itad_id from games
                   where itad_id is not null and (bundle_checked_at is null or bundle_checked_at < now() - interval '24 hours')
                     and app_id in (select app_id from user_libraries union select app_id from app_snapshots)""")
            return cur.fetchall()

    def write_critic(self, app_id: int, data: dict | None) -> None:
        with self.conn.cursor() as cur:
            d = data or {}
            cur.execute(
                """update games set metacritic = %s, metacritic_user = %s, opencritic = %s,
                   critic_checked_at = now() where app_id = %s""",
                (d.get("metacritic"), d.get("metacritic_user"), d.get("opencritic"), app_id),
            )

    def calendar_fresh(self) -> bool:
        with self.conn.cursor() as cur:
            cur.execute("select count(*) from release_calendar where updated_at > now() - interval '6 hours'")
            return cur.fetchone()[0] > 0

    def replace_release_calendar(self, events: list[dict]) -> None:
        with self.conn.cursor() as cur:
            cur.execute("delete from release_calendar")
            cur.executemany(
                """insert into release_calendar (game_name, release_date, url, steam_app_id)
                   values (%(name)s, %(date)s, %(url)s,
                           (select app_id from games where lower(name) = lower(%(name)s) limit 1))""",
                events,
            )

    def tracked_app_ids(self) -> list[int]:
        with self.conn.cursor() as cur:
            cur.execute("select app_id from user_libraries union select app_id from games")
            return sorted(row[0] for row in cur.fetchall())

    def app_ids_missing_tags(self) -> list[int]:
        with self.conn.cursor() as cur:
            cur.execute("select app_id from games where tags is null or tags = '{}'")
            return [row[0] for row in cur.fetchall()]

    def detail_targets(self) -> list[int]:
        """Games whose card detail fields haven't been captured yet."""
        with self.conn.cursor() as cur:
            cur.execute("select app_id from games where details_checked_at is null")
            return [row[0] for row in cur.fetchall()]

    def write_igdb(self, app_id: int, data: dict | None) -> None:
        """Store IGDB signals; None marks the app checked (no IGDB match) so we don't refetch."""
        with self.conn.cursor() as cur:
            if data:
                cur.execute(
                    """update games set igdb_id = %s, igdb_hypes = %s, igdb_follows = %s,
                       igdb_aggregated_rating = %s, igdb_rating_count = %s, igdb_checked_at = now()
                       where app_id = %s""",
                    (data.get("igdb_id"), data.get("hypes"), data.get("follows"),
                     data.get("aggregated_rating"), data.get("aggregated_rating_count"), app_id),
                )
            else:
                cur.execute("update games set igdb_checked_at = now() where app_id = %s", (app_id,))

    def igdb_targets(self) -> list[int]:
        """App ids released within ~30 days whose IGDB data is unset or older than ~a day."""
        with self.conn.cursor() as cur:
            cur.execute(
                """select app_id from games
                   where released_at is not null and released_at >= current_date - interval '30 days'
                     and (igdb_checked_at is null or igdb_checked_at < now() - interval '20 hours')
                   order by released_at desc""")
            return [row[0] for row in cur.fetchall()]

    def record_health(self, source: str, ok: bool, detail: str | None = None) -> None:
        """Upsert per-source health. last_success_at is only advanced on success;
        on error the previous success time is preserved (so 'last worked 3 days ago' stays visible)."""
        status = "ok" if ok else "error"
        with self.conn.cursor() as cur:
            cur.execute(
                """insert into collector_health (source, last_status, last_detail, last_success_at, updated_at)
                   values (%s, %s, %s, case when %s = 'ok' then now() else null end, now())
                   on conflict (source) do update set
                     last_status = excluded.last_status,
                     last_detail = excluded.last_detail,
                     last_success_at = case when excluded.last_status = 'ok'
                                            then now() else collector_health.last_success_at end,
                     updated_at = now()""",
                (source, status, detail, status),
            )
