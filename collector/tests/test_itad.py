import httpx, respx
from steam_collector.itad import parse_prices, lookup_itad_ids, fetch_prices, parse_game_info, fetch_game_info, detect_price_drops, parse_subs, fetch_subs, parse_bundles, fetch_bundles, redact_key


def test_parse_bundles_counts_and_names_first():
    payload = [
        {"title": "Awesome Automation Bundle", "page": {"name": "Humble Bundle"}, "expiry": None},
        {"title": "Indie Pack", "page": {"name": "Fanatical"}, "expiry": "2026-07-01T00:00:00+00:00"},
    ]
    assert parse_bundles(payload) == {"count": 2, "name": "Humble Bundle: Awesome Automation Bundle"}


def test_parse_bundles_empty():
    assert parse_bundles([]) == {"count": 0, "name": None}


def test_parse_subs_maps_id_to_sub_names():
    payload = [
        {"id": "g1", "subs": [{"id": 6, "name": "Game Pass", "leaving": None}]},
        {"id": "g2", "subs": []},
        {"id": "g3", "subs": [{"id": 1, "name": "EA Play"}, {"id": 2, "name": "Humble Choice"}]},
    ]
    out = parse_subs(payload)
    assert out == {"g1": ["Game Pass"], "g2": [], "g3": ["EA Play", "Humble Choice"]}


@respx.mock
def test_fetch_subs_posts_ids():
    route = respx.post(f"{BASE}/games/subs/v1").mock(
        return_value=httpx.Response(200, json=[{"id": "g1", "subs": [{"id": 6, "name": "Game Pass"}]}]))
    with httpx.Client() as c:
        out = fetch_subs(c, "K", ["g1"], country="DE")
    assert route.called
    assert out["g1"] == ["Game Pass"]


def test_detect_price_drops_flags_lower_prices_and_atl():
    old = {1: (2000, 1500), 2: (1000, 800), 3: (None, None)}
    new_rows = [
        {"app_id": 1, "price_cents": 1400, "atl_cents": 1500},  # dropped 2000->1400, <=atl -> at_atl
        {"app_id": 2, "price_cents": 1000, "atl_cents": 800},   # unchanged -> no drop
        {"app_id": 3, "price_cents": 500, "atl_cents": 500},    # no old price -> no drop
        {"app_id": 4, "price_cents": 0, "atl_cents": 0},        # free / no old -> no drop
    ]
    drops = detect_price_drops(old, new_rows)
    assert len(drops) == 1
    assert drops[0] == {"app_id": 1, "old_cents": 2000, "new_cents": 1400, "at_atl": True}


def test_detect_price_drops_non_atl_drop():
    drops = detect_price_drops({9: (3000, 1000)}, [{"app_id": 9, "price_cents": 2500, "atl_cents": 1000}])
    assert drops == [{"app_id": 9, "old_cents": 3000, "new_cents": 2500, "at_atl": False}]

BASE = "https://api.isthereanydeal.com"


def test_parse_game_info_extracts_critic_scores():
    payload = {"reviews": [
        {"source": "Steam", "score": 98}, {"source": "Metascore", "score": 93},
        {"source": "Metacritic User Score", "score": 85}, {"source": "OpenCritic", "score": 94}]}
    out = parse_game_info(payload)
    assert out == {"metacritic": 93, "metacritic_user": 85, "opencritic": 94}


def test_parse_game_info_missing_sources_are_none():
    assert parse_game_info({"reviews": [{"source": "Steam", "score": 90}]}) == {
        "metacritic": None, "metacritic_user": None, "opencritic": None}


@respx.mock
def test_fetch_game_info_calls_info_endpoint():
    respx.get(f"{BASE}/games/info/v2").mock(
        return_value=httpx.Response(200, json={"reviews": [{"source": "OpenCritic", "score": 88}]}))
    with httpx.Client() as c:
        out = fetch_game_info(c, "K", "gid-1")
    assert out["opencritic"] == 88


def test_parse_prices_picks_cheapest_deal_and_atl():
    payload = [{
        "id": "uuid-1",
        "historyLow": {"all": {"amountInt": 612, "currency": "EUR"}},
        "deals": [
            {"shop": {"name": "Steam"}, "price": {"amountInt": 2999, "currency": "EUR"}, "cut": 0},
            {"shop": {"name": "Epic"}, "price": {"amountInt": 2450, "currency": "EUR"}, "cut": 18},
        ],
    }]
    out = parse_prices(payload)
    row = out["uuid-1"]
    assert row["price_cents"] == 2450 and row["shop"] == "Epic" and row["cut"] == 18
    assert row["atl_cents"] == 612 and row["currency"] == "EUR"


def test_parse_prices_handles_no_deals():
    out = parse_prices([{"id": "u2", "historyLow": {"all": {"amountInt": 100, "currency": "EUR"}}, "deals": []}])
    assert out["u2"]["price_cents"] is None and out["u2"]["atl_cents"] == 100


@respx.mock
def test_lookup_itad_ids_batches_app_ids():
    respx.post(f"{BASE}/lookup/id/shop/61/v1").mock(
        return_value=httpx.Response(200, json={"app/570": "uuid-570", "app/730": None}))
    with httpx.Client() as c:
        out = lookup_itad_ids(c, "K", [570, 730])
    assert out == {570: "uuid-570"}  # null ids dropped


@respx.mock
def test_fetch_prices_posts_ids_with_country():
    route = respx.post(f"{BASE}/games/prices/v3").mock(
        return_value=httpx.Response(200, json=[{"id": "uuid-570", "historyLow": {"all": {"amountInt": 699, "currency": "EUR"}}, "deals": []}]))
    with httpx.Client() as c:
        out = fetch_prices(c, "K", ["uuid-570"], country="DE")
    assert route.called
    assert out["uuid-570"]["atl_cents"] == 699


@respx.mock
def test_fetch_prices_chunks_201_ids_into_two_requests():
    """201 ids must produce exactly 2 POST requests (batches of <=200) and merge results."""
    ids = [f"uuid-{i}" for i in range(201)]
    call_count = 0

    def handler(request):
        nonlocal call_count
        call_count += 1
        sent = request.content  # bytes; we just need to count calls
        import json
        batch = json.loads(sent)
        return httpx.Response(200, json=[
            {"id": gid, "historyLow": {"all": {"amountInt": 100, "currency": "EUR"}}, "deals": []}
            for gid in batch
        ])

    respx.post(f"{BASE}/games/prices/v3").mock(side_effect=handler)
    with httpx.Client() as c:
        out = fetch_prices(c, "K", ids)
    assert call_count == 2, f"expected 2 POST requests, got {call_count}"
    assert len(out) == 201
    assert all(out[gid]["atl_cents"] == 100 for gid in ids)


@respx.mock
def test_fetch_prices_empty_ids_makes_no_requests():
    route = respx.post(f"{BASE}/games/prices/v3").mock(return_value=httpx.Response(200, json=[]))
    with httpx.Client() as c:
        out = fetch_prices(c, "K", [])
    assert not route.called
    assert out == {}


@respx.mock
def test_fetch_subs_chunks_201_ids_into_two_requests():
    """201 ids must produce exactly 2 POST requests (batches of <=200) and merge results."""
    ids = [f"uuid-{i}" for i in range(201)]
    call_count = 0

    def handler(request):
        nonlocal call_count
        call_count += 1
        import json
        batch = json.loads(request.content)
        return httpx.Response(200, json=[
            {"id": gid, "subs": [{"id": 1, "name": "Game Pass"}]}
            for gid in batch
        ])

    respx.post(f"{BASE}/games/subs/v1").mock(side_effect=handler)
    with httpx.Client() as c:
        out = fetch_subs(c, "K", ids)
    assert call_count == 2, f"expected 2 POST requests, got {call_count}"
    assert len(out) == 201
    assert all(out[gid] == ["Game Pass"] for gid in ids)


@respx.mock
def test_fetch_subs_empty_ids_makes_no_requests():
    route = respx.post(f"{BASE}/games/subs/v1").mock(return_value=httpx.Response(200, json=[]))
    with httpx.Client() as c:
        out = fetch_subs(c, "K", [])
    assert not route.called
    assert out == {}


def test_redact_key_replaces_key_value_in_url():
    url = "https://api.isthereanydeal.com/games/prices/v3?key=eabd900edeadbeef&country=DE"
    assert redact_key(url) == "https://api.isthereanydeal.com/games/prices/v3?key=REDACTED&country=DE"


def test_redact_key_leaves_strings_without_key_param_unchanged():
    plain = "connection timeout after 20s"
    assert redact_key(plain) == plain


def test_redact_key_handles_key_at_end_of_string():
    url = "https://api.isthereanydeal.com/games/subs/v1?country=DE&key=secret123"
    assert redact_key(url) == "https://api.isthereanydeal.com/games/subs/v1?country=DE&key=REDACTED"
