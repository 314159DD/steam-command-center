import httpx
import respx
from steam_collector.igdb import (
    get_igdb_token, parse_external_games, parse_games, fetch_igdb,
)


def test_parse_external_games_maps_appid_to_game_id():
    payload = [{"id": 1, "game": 111, "uid": "570"}, {"id": 2, "game": 222, "uid": "730"}]
    assert parse_external_games(payload) == {570: 111, 730: 222}


def test_parse_games_extracts_signals():
    payload = [
        {"id": 111, "hypes": 42, "follows": 900, "aggregated_rating": 88.5, "aggregated_rating_count": 12},
        {"id": 222, "follows": 5},
    ]
    out = parse_games(payload)
    assert out[111] == {"hypes": 42, "follows": 900, "aggregated_rating": 88.5, "aggregated_rating_count": 12}
    assert out[222] == {"hypes": None, "follows": 5, "aggregated_rating": None, "aggregated_rating_count": None}


@respx.mock
def test_get_igdb_token_returns_access_token():
    respx.post("https://id.twitch.tv/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "tok123", "expires_in": 5000000}))
    with httpx.Client() as c:
        assert get_igdb_token(c, "cid", "secret") == "tok123"


@respx.mock
def test_fetch_igdb_matches_and_merges():
    respx.post("https://api.igdb.com/v4/external_games").mock(
        return_value=httpx.Response(200, json=[{"id": 1, "game": 111, "uid": "570"}]))
    respx.post("https://api.igdb.com/v4/games").mock(
        return_value=httpx.Response(200, json=[
            {"id": 111, "hypes": 42, "follows": 900, "aggregated_rating": 88.5, "aggregated_rating_count": 12}]))
    with httpx.Client() as c:
        out = fetch_igdb(c, "cid", "tok123", [570, 999])
    assert out[570] == {"igdb_id": 111, "hypes": 42, "follows": 900,
                        "aggregated_rating": 88.5, "aggregated_rating_count": 12}
    assert 999 not in out


@respx.mock
def test_fetch_igdb_empty_input_makes_no_requests():
    with httpx.Client() as c:
        assert fetch_igdb(c, "cid", "tok", []) == {}


@respx.mock
def test_fetch_igdb_sends_appid_filter_in_body():
    ext = respx.post("https://api.igdb.com/v4/external_games").mock(
        return_value=httpx.Response(200, json=[{"id": 1, "game": 111, "uid": "570"}]))
    respx.post("https://api.igdb.com/v4/games").mock(
        return_value=httpx.Response(200, json=[{"id": 111, "hypes": 1}]))
    with httpx.Client() as c:
        fetch_igdb(c, "cid", "tok", [570])
    body = ext.calls.last.request.content.decode()
    assert 'external_game_source = 1' in body
    assert '"570"' in body


def test_parse_external_games_skips_bad_rows():
    payload = [{"id": 1, "game": 111, "uid": "570"}, {"uid": None, "game": 5},
               {"uid": "abc", "game": 9}, {"uid": "730"}]
    assert parse_external_games(payload) == {570: 111}
