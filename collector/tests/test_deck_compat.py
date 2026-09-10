import httpx, respx
from steam_collector.deck_compat import parse_deck_compat, fetch_deck_compat

URL = "https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport"


def test_parse_deck_compat_maps_categories():
    assert parse_deck_compat({"results": {"resolved_category": 3}}) == "verified"
    assert parse_deck_compat({"results": {"resolved_category": 2}}) == "playable"
    assert parse_deck_compat({"results": {"resolved_category": 1}}) == "unsupported"
    assert parse_deck_compat({"results": {"resolved_category": 0}}) is None  # unknown
    assert parse_deck_compat({}) is None


@respx.mock
def test_fetch_deck_compat_returns_label():
    respx.get(URL).mock(return_value=httpx.Response(200, json={"results": {"resolved_category": 3}}))
    with httpx.Client() as c:
        assert fetch_deck_compat(c, 1086940) == "verified"


@respx.mock
def test_fetch_deck_compat_non_200_is_none():
    respx.get(URL).mock(return_value=httpx.Response(500))
    with httpx.Client() as c:
        assert fetch_deck_compat(c, 1) is None
