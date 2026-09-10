import httpx, respx
from steam_collector.review_histogram import parse_review_histogram, fetch_review_histogram


def test_parse_review_histogram_computes_recent_pct_and_up_trend():
    payload = {"results": {
        "recent": [{"date": 1, "recommendations_up": 80, "recommendations_down": 20}],   # 80%
        "rollups": [{"date": 1, "recommendations_up": 50, "recommendations_down": 50}],   # 50%
    }}
    out = parse_review_histogram(payload)
    assert out["recent_pct"] == 80
    assert out["overall_pct"] == 50
    assert out["trend"] == "up"
    assert out["recent_up"] == 80 and out["recent_down"] == 20


def test_parse_review_histogram_down_and_flat():
    down = parse_review_histogram({"results": {
        "recent": [{"date": 1, "recommendations_up": 30, "recommendations_down": 70}],
        "rollups": [{"date": 1, "recommendations_up": 80, "recommendations_down": 20}]}})
    assert down["trend"] == "down"
    flat = parse_review_histogram({"results": {
        "recent": [{"date": 1, "recommendations_up": 51, "recommendations_down": 49}],
        "rollups": [{"date": 1, "recommendations_up": 50, "recommendations_down": 50}]}})
    assert flat["trend"] == "flat"


def test_parse_review_histogram_empty_returns_nulls():
    out = parse_review_histogram({"results": {"recent": [], "rollups": []}})
    assert out["recent_pct"] is None and out["trend"] is None


@respx.mock
def test_fetch_review_histogram_calls_endpoint():
    respx.get("https://store.steampowered.com/appreviewhistogram/570").mock(
        return_value=httpx.Response(200, json={"results": {"recent": [{"date": 1, "recommendations_up": 9, "recommendations_down": 1}], "rollups": []}}))
    with httpx.Client() as c:
        out = fetch_review_histogram(c, 570)
    assert out["recent_pct"] == 90
