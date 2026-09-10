import httpx
import respx

from steam_collector.steam_players import fetch_player_count
from steam_collector.config import API_BASE


@respx.mock
def test_fetch_player_count_returns_int():
    route = respx.get(f"{API_BASE}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/").mock(
        return_value=httpx.Response(200, json={"response": {"result": 1, "player_count": 812940}})
    )
    with httpx.Client() as c:
        assert fetch_player_count(c, 570) == 812940
    assert route.called


@respx.mock
def test_fetch_player_count_missing_returns_none():
    respx.get(f"{API_BASE}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/").mock(
        return_value=httpx.Response(200, json={"response": {"result": 42}})
    )
    with httpx.Client() as c:
        assert fetch_player_count(c, 999) is None
