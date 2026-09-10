from steam_collector import run

def test_run_once_calls_each_stage(monkeypatch):
    calls = []
    monkeypatch.setattr(run, "fetch_featured", lambda c: calls.append("featured") or [
        {"app_id": 300, "category": "new_release", "rank": 0, "name": "X",
         "header_image": None, "price_cents": 1999, "discount_percent": 0}])
    monkeypatch.setattr(run, "fetch_trending", lambda c: calls.append("trending") or [
        {"app_id": 440, "category": "trending", "rank": 0, "name": "Y",
         "header_image": None, "price_cents": None}])
    monkeypatch.setattr(run, "fetch_top_sellers", lambda c: calls.append("topsellers") or [
        {"app_id": 620, "category": "top_seller", "rank": 0, "name": "Z",
         "header_image": None, "price_cents": None}])
    monkeypatch.setattr(run, "fetch_most_played", lambda c: calls.append("charts") or [
        {"app_id": 730, "rank": 1, "peak": 100}])
    monkeypatch.setattr(run, "fetch_proton_summary", lambda c, a: {"tier": "gold"})
    monkeypatch.setattr(run, "fetch_deck_compat", lambda c, a: calls.append("deck") or "verified")
    monkeypatch.setattr(run, "fetch_spy_appdetails", lambda c, a: calls.append("spy") or {"owners": "1 .. 2"})
    monkeypatch.setattr(run, "fetch_review_histogram", lambda c, a: calls.append("revhist") or {"trend": "up", "recent_pct": 80})
    monkeypatch.setattr(run, "fetch_hltb", lambda c, name: calls.append("hltb") or {"main": 23, "extra": 48, "completionist": 95})
    monkeypatch.setattr(run, "fetch_calendar", lambda c: calls.append("cal") or [{"name": "X", "date": "2026-07-01", "url": "u"}])
    monkeypatch.setattr(run, "TWITCH_CLIENT_ID", "cid")
    monkeypatch.setattr(run, "TWITCH_CLIENT_SECRET", "secret")
    monkeypatch.setattr(run, "get_igdb_token", lambda h, cid, sec: "tok")
    monkeypatch.setattr(run, "fetch_igdb", lambda h, cid, tok, ids: calls.append("igdbfetch") or {
        308: {"igdb_id": 1, "hypes": 5, "follows": 9, "aggregated_rating": 80, "aggregated_rating_count": 3}})
    monkeypatch.setattr(run, "ITAD_API_KEY", "K")
    monkeypatch.setattr(run, "lookup_itad_ids", lambda h, k, ids: calls.append("itadlookup") or {303: "uuid-x"})
    monkeypatch.setattr(run, "fetch_prices", lambda h, k, ids, country="DE": calls.append("itadprices") or {"uuid-x": {"price_cents": 1999, "atl_cents": 999, "cut": 10, "shop": "Steam", "currency": "EUR"}})
    monkeypatch.setattr(run, "fetch_game_info", lambda h, k, gid: calls.append("itadinfo") or {"metacritic": 90, "opencritic": 88})
    monkeypatch.setattr(run, "fetch_subs", lambda h, k, ids, country="DE": calls.append("itadsubs") or {"uuid-x": ["Game Pass"]})
    monkeypatch.setattr(run, "fetch_bundles", lambda h, k, gid, country="DE": calls.append("itadbundles") or {"count": 1, "name": "Humble: X"})
    monkeypatch.setattr(run.time, "sleep", lambda s: None)
    monkeypatch.setattr(run, "fetch_player_count", lambda c, a: 100)
    monkeypatch.setattr(run, "fetch_news", lambda c, a, count=5: [
        {"gid": f"g{a}", "app_id": a, "title": "Patch 1.0", "body": "Out of Early Access",
         "url": "u", "posted_at": 1}])
    monkeypatch.setattr(run, "enrich_game", lambda c, a: {
        "app_id": a, "name": "X", "tags": ["Action"], "genres": ["Action"],
        "header_image": None, "is_released": True, "price_cents": 1999,
        "review_count": 500, "review_score": 90})

    class W:
        def __init__(self): self.disc=[]; self.pc=[]; self.up=[]; self.games=[]; self.health=[]
        def record_health(self, source, ok, detail=""): self.health.append((source, ok))
        def write_discovery(self, r): self.disc=r; calls.append("disc")
        def write_player_counts(self, r): self.pc=r; calls.append("pc")
        def write_updates(self, r): self.up=r; calls.append("up")
        def tracked_app_ids(self): return [300]
        def app_ids_missing_tags(self): return [300]
        def detail_targets(self): return [309]
        def upsert_games(self, r): self.games=r; calls.append("games")
        def ensure_apps(self, ids): self.ensured += list(ids); calls.append("ensure")
        def app_ids_missing_proton(self): return [300]
        def write_proton(self, app_id, data): self.proton=(app_id, data); calls.append("proton")
        def app_ids_missing_deck(self): return [305]
        def write_deck(self, app_id, label): self.deck=(app_id, label); calls.append("deckwrite")
        def app_ids_missing_spy(self): return [301]
        def write_spy(self, app_id, data): self.spy=(app_id, data); calls.append("spywrite")
        def app_ids_stale_review_trend(self): return [302]
        def write_review_trend(self, app_id, data): self.rev=(app_id, data); calls.append("revwrite")
        def hltb_targets(self): return [(306, "Hades")]
        def write_hltb(self, app_id, data): self.hltb=(app_id, data); calls.append("hltbwrite")
        def calendar_fresh(self): return False
        def replace_release_calendar(self, events): self.cal=events; calls.append("calwrite")
        def stale_itad_targets(self): return [(303, None)]
        def current_prices(self, ids): return {}
        def record_price_drops(self, drops): self.drops=drops; calls.append("dropsrec")
        def write_itad_prices(self, rows): self.itad=rows; calls.append("itadwrite")
        def stale_critic_targets(self): return [(304, "uuid-x")]
        def write_critic(self, app_id, data): self.critic=(app_id, data); calls.append("criticwrite")
        def bundle_targets(self): return [(307, "uuid-x")]
        def write_bundle(self, app_id, data): self.bundle=(app_id, data); calls.append("bundlewrite")
        def igdb_targets(self): return [308]
        def write_igdb(self, app_id, data): self.igdb=(app_id, data); calls.append("igdbwrite")
    w = W()
    w.ensured = []
    run.run_once(writer=w, http=None)

    assert "featured" in calls and "trending" in calls and "topsellers" in calls and "disc" in calls and "pc" in calls and "up" in calls
    assert "charts" in calls
    assert 730 in w.ensured   # most-played chart app registered
    assert 300 in w.ensured   # tracked library/discovery app registered before polling (FK guard)
    assert "proton" in calls and w.proton == (300, {"tier": "gold"})
    assert "deck" in calls and w.deck == (305, "verified")
    assert "spy" in calls and w.spy == (301, {"owners": "1 .. 2"})
    assert "revhist" in calls and w.rev == (302, {"trend": "up", "recent_pct": 80})
    assert "hltb" in calls and w.hltb == (306, {"main": 23, "extra": 48, "completionist": 95})
    assert "cal" in calls and w.cal[0]["name"] == "X"
    assert "itadprices" in calls and w.itad[0]["price_cents"] == 1999 and w.itad[0]["app_id"] == 303
    assert "itadsubs" in calls and w.itad[0]["sub_names"] == ["Game Pass"]
    assert "itadinfo" in calls and w.critic == (304, {"metacritic": 90, "opencritic": 88})
    assert "itadbundles" in calls and w.bundle == (307, {"count": 1, "name": "Humble: X"})
    assert w.up[0]["classification"] == "MAJOR"   # classifier wired in
    assert w.pc[0]["app_id"] == 300 and w.pc[0]["player_count"] == 100
    assert "games" in calls
    assert w.games[0]["tags"] == ["Action"]
    assert calls.index("games") < calls.index("pc")  # enrichment runs before polling
    # per-source health logging recorded success entries
    assert ("search", True) in w.health
    assert ("charts", True) in w.health
    assert ("proton", True) in w.health
    assert ("itad_prices", True) in w.health
    assert "igdbfetch" in calls and w.igdb == (308, {"igdb_id": 1, "hypes": 5, "follows": 9,
        "aggregated_rating": 80, "aggregated_rating_count": 3})
    assert ("igdb", True) in w.health
    assert ("details", True) in w.health   # the card-detail backfill pass ran + health-logged
