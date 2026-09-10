import httpx, respx
from steam_collector.steam_news import fetch_news, strip_bbcode
from steam_collector.config import API_BASE

def test_strip_bbcode_removes_tags_and_collapses_space():
    raw = "[h1]Big News[/h1]\n[b]Added[/b] [url=x]hero[/url].  [img]y[/img]"
    assert strip_bbcode(raw) == "Big News Added hero."

@respx.mock
def test_fetch_news_normalizes_items():
    respx.get(f"{API_BASE}/ISteamNews/GetNewsForApp/v2/").mock(
        return_value=httpx.Response(200, json={"appnews": {"appid": 570, "newsitems": [
            {"gid": "g1", "title": "Patch 1.4", "contents": "[b]New hero[/b] Vex",
             "url": "u1", "date": 1718380800}
        ]}})
    )
    with httpx.Client() as c:
        items = fetch_news(c, 570, count=1)
    assert items == [{
        "gid": "g1", "app_id": 570, "title": "Patch 1.4",
        "body": "New hero Vex", "url": "u1", "posted_at": "2024-06-14T16:00:00+00:00",
    }]
