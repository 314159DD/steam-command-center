from steam_collector.store_writer import StoreWriter


class _FakeCursor:
    def __init__(self, log): self.log = log
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def execute(self, sql, params=None): self.log.append(("execute", sql, params))
    def executemany(self, sql, rows): self.log.append(("executemany", sql, list(rows)))
    def fetchall(self): return []


class _FakeConn:
    def __init__(self): self.log = []
    def cursor(self): return _FakeCursor(self.log)


def test_write_discovery_upserts_games_and_inserts_snapshots():
    conn = _FakeConn()
    w = StoreWriter(conn)
    rows = [{"app_id": 300, "category": "new_release", "rank": 0, "name": "Hollow Veins",
             "header_image": "h.jpg", "price_cents": 1999, "discount_percent": 0}]
    w.write_discovery(rows)

    sqls = " ".join(entry[1].lower() for entry in conn.log)
    assert "insert into games" in sqls
    assert "insert into app_snapshots" in sqls
    games_call = next(e for e in conn.log if "insert into games" in e[1].lower())
    assert games_call[2][0]["app_id"] == 300


def test_ensure_apps_inserts_app_ids_without_clobbering_existing():
    conn = _FakeConn()
    w = StoreWriter(conn)
    w.ensure_apps([730, 570])
    call = next(e for e in conn.log if "insert into games" in e[1].lower())
    assert "do nothing" in call[1].lower()
    assert call[2] == [{"app_id": 730}, {"app_id": 570}]


def test_write_proton_sets_fields_or_marks_unrated():
    conn = _FakeConn()
    w = StoreWriter(conn)
    w.write_proton(570, {"tier": "gold", "trending_tier": "gold", "confidence": "strong"})
    w.write_proton(999, None)
    assert any("proton_tier = %s" in e[1].lower() for e in conn.log)
    unrated = next(e for e in conn.log if "'unrated'" in e[1].lower())
    assert unrated[2] == (999,)


def test_write_spy_stores_owners_or_marks_checked():
    conn = _FakeConn()
    w = StoreWriter(conn)
    w.write_spy(570, {"owners": "1 .. 2", "ccu": 5, "avg_playtime": 10, "tags": {"MOBA": 3}})
    w.write_spy(999, None)
    assert any("owners_estimate = %s" in e[1].lower() for e in conn.log)
    marked = next(e for e in conn.log if "spy_checked_at = now()" in e[1].lower() and "owners_estimate" not in e[1].lower())
    assert marked[2] == (999,)


def test_record_health_success_sets_last_success_at():
    conn = _FakeConn()
    w = StoreWriter(conn)
    w.record_health("search", True, "wrote 40 rows")
    call = next(e for e in conn.log if "collector_health" in e[1].lower())
    sql = call[1].lower()
    assert "insert into collector_health" in sql
    assert "on conflict (source)" in sql
    assert "last_success_at" in sql
    # success params carry the source / status / detail
    assert "search" in call[2]
    assert "ok" in call[2]
    assert "wrote 40 rows" in call[2]


def test_record_health_error_does_not_clobber_prior_success():
    conn = _FakeConn()
    w = StoreWriter(conn)
    w.record_health("search", False, "boom")
    call = next(e for e in conn.log if "collector_health" in e[1].lower())
    sql = call[1].lower()
    # error path must NOT unconditionally set last_success_at = now();
    # it preserves the prior value via a conditional/case form.
    assert "case" in sql or "coalesce" in sql
    assert "error" in call[2]
    assert "boom" in call[2]


def test_empty_inputs_do_nothing():
    conn = _FakeConn()
    w = StoreWriter(conn)
    w.write_discovery([]); w.write_player_counts([]); w.write_updates([]); w.upsert_games([]); w.ensure_apps([])
    assert conn.log == []


def test_write_igdb_updates_signal_columns():
    conn = _FakeConn()
    StoreWriter(conn).write_igdb(570, {"igdb_id": 111, "hypes": 42, "follows": 900,
                                       "aggregated_rating": 88.5, "aggregated_rating_count": 12})
    call = next(e for e in conn.log if "igdb_hypes" in e[1].lower())
    assert "update games set" in call[1].lower()
    assert "igdb_checked_at = now()" in call[1].lower()
    assert call[2] == (111, 42, 900, 88.5, 12, 570)


def test_write_igdb_none_marks_checked_without_clobbering():
    conn = _FakeConn()
    StoreWriter(conn).write_igdb(999, None)
    call = next(e for e in conn.log if "igdb_checked_at = now()" in e[1].lower())
    assert "igdb_hypes" not in call[1].lower()
    assert call[2] == (999,)


def test_upsert_games_writes_card_fields_and_marks_details_checked():
    conn = _FakeConn()
    StoreWriter(conn).upsert_games([{
        "app_id": 570, "name": "Dota 2", "developer": "Valve", "has_vac": True,
        "family_sharing": False, "trailer_movie_id": 999, "screenshots": ["s1.jpg"],
    }])
    call = next(e for e in conn.log if "insert into games" in e[1].lower())
    sql = call[1].lower()
    assert "developer" in sql and "has_vac" in sql and "family_sharing" in sql
    assert "trailer_movie_id" in sql and "screenshots" in sql and "details_checked_at = now()" in sql
    row = call[2][0]
    assert row["developer"] == "Valve" and row["trailer_movie_id"] == 999
    # screenshots serialized to JSON text for the jsonb column
    assert row["screenshots"] == '["s1.jpg"]'
