import httpx, respx
from steam_collector.proton_db import parse_proton_summary, fetch_proton_summary


def test_parse_proton_summary_maps_fields():
    p = {"tier": "gold", "trendingTier": "platinum", "confidence": "strong",
         "score": 0.78, "total": 2058, "bestReportedTier": "platinum"}
    out = parse_proton_summary(p)
    assert out["tier"] == "gold"
    assert out["trending_tier"] == "platinum"
    assert out["confidence"] == "strong"
    assert out["total"] == 2058


@respx.mock
def test_fetch_proton_summary_returns_dict_for_rated_game():
    respx.get("https://www.protondb.com/api/v1/reports/summaries/570.json").mock(
        return_value=httpx.Response(200, json={"tier": "gold", "trendingTier": "gold", "confidence": "strong", "total": 346}))
    with httpx.Client() as c:
        out = fetch_proton_summary(c, 570)
    assert out["tier"] == "gold"


@respx.mock
def test_fetch_proton_summary_returns_none_for_unrated_404():
    respx.get("https://www.protondb.com/api/v1/reports/summaries/999.json").mock(
        return_value=httpx.Response(404, text="not found"))
    with httpx.Client() as c:
        assert fetch_proton_summary(c, 999) is None
