import httpx, respx
from steam_collector.steam_charts import parse_most_played, fetch_most_played
from steam_collector.config import API_BASE


def test_parse_most_played_extracts_ranked_appids():
    payload = {"response": {"ranks": [
        {"rank": 1, "appid": 730, "peak_in_game": 1275982},
        {"rank": 2, "appid": 578080, "peak_in_game": 732248},
        {"rank": 3, "appid": 570, "peak_in_game": 635321},
    ]}}
    rows = parse_most_played(payload)
    assert [r["app_id"] for r in rows] == [730, 578080, 570]
    assert rows[0]["rank"] == 1 and rows[0]["peak"] == 1275982


def test_parse_most_played_empty_payload():
    assert parse_most_played({}) == []


@respx.mock
def test_fetch_most_played_calls_charts_endpoint():
    payload = {"response": {"ranks": [{"rank": 1, "appid": 730, "peak_in_game": 100}]}}
    route = respx.get(f"{API_BASE}/ISteamChartsService/GetMostPlayedGames/v1/").mock(
        return_value=httpx.Response(200, json=payload))
    with httpx.Client() as c:
        rows = fetch_most_played(c)
    assert route.called
    assert rows[0]["app_id"] == 730
