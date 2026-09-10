import httpx, respx
from steam_collector.steam_spy import parse_spy_appdetails, fetch_spy_appdetails


def test_parse_spy_appdetails_maps_fields():
    p = {"appid": 570, "name": "Dota 2", "owners": "100,000,000 .. 200,000,000",
         "ccu": 623941, "average_forever": 120, "median_forever": 50, "tags": {"MOBA": 20225}}
    out = parse_spy_appdetails(p)
    assert out["owners"] == "100,000,000 .. 200,000,000"
    assert out["ccu"] == 623941
    assert out["avg_playtime"] == 120
    assert out["tags"]["MOBA"] == 20225


def test_parse_spy_appdetails_tolerates_missing_fields():
    out = parse_spy_appdetails({"appid": 1})
    assert out["owners"] is None and out["ccu"] is None and out["tags"] == {}


@respx.mock
def test_fetch_spy_appdetails_calls_steamspy():
    route = respx.get("https://steamspy.com/api.php").mock(
        return_value=httpx.Response(200, json={"appid": 570, "owners": "1 .. 2", "ccu": 5, "tags": []}))
    with httpx.Client() as c:
        out = fetch_spy_appdetails(c, 570)
    assert route.called
    assert out["owners"] == "1 .. 2"
    assert out["tags"] == {}  # SteamSpy returns [] (not dict) when no tags
