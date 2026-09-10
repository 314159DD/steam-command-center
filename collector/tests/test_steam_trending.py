import json, pathlib
import httpx, respx

from steam_collector.steam_trending import parse_trending, fetch_trending, fetch_new_releases
from steam_collector.config import STORE_BASE

FIX = pathlib.Path(__file__).parent / "fixtures" / "search_popularnew.json"
FIX_NEW = pathlib.Path(__file__).parent / "fixtures" / "search_newreleases.json"


def test_parse_trending_extracts_appids_in_rank_order():
    payload = json.loads(FIX.read_text(encoding="utf-8"))
    rows = parse_trending(payload)

    assert [r["app_id"] for r in rows] == [440, 570, 730]
    assert all(r["category"] == "trending" for r in rows)
    assert rows[0]["rank"] == 0 and rows[0]["name"] == "Team Fortress 2"
    # capsule image is captured from the row when present, else None
    assert rows[0]["header_image"] == "cap440.jpg"
    assert rows[1]["header_image"] is None


def test_parse_trending_unescapes_entities_and_skips_non_app_rows():
    payload = json.loads(FIX.read_text(encoding="utf-8"))
    rows = parse_trending(payload)
    names = {r["app_id"]: r["name"] for r in rows}

    # the "New & Trending" header row has no data-ds-appid and must be skipped
    assert len(rows) == 3
    # &amp; entity is unescaped; bundle-style appid "730,12345" takes the first id
    assert names[730] == "Counter-Strike 2 & Friends"


def test_parse_trending_empty_payload_returns_empty():
    assert parse_trending({}) == []


@respx.mock
def test_fetch_trending_queries_popularnew_filter_and_parses():
    payload = json.loads(FIX.read_text(encoding="utf-8"))
    route = respx.get(f"{STORE_BASE}/search/results/").mock(
        return_value=httpx.Response(200, json=payload)
    )
    with httpx.Client() as c:
        rows = fetch_trending(c)

    assert route.called
    assert route.calls.last.request.url.params["filter"] == "popularnew"
    assert rows[0]["app_id"] == 440


@respx.mock
def test_fetch_new_releases_sorts_by_release_date_and_paginates():
    payload = json.loads(FIX_NEW.read_text(encoding="utf-8"))
    route = respx.get(f"{STORE_BASE}/search/results/").mock(
        return_value=httpx.Response(200, json=payload)
    )
    with httpx.Client() as c:
        rows = fetch_new_releases(c)

    # two pages requested (start=0 then start=100)
    assert route.call_count == 2
    starts = sorted(int(call.request.url.params["start"]) for call in route.calls)
    assert starts == [0, 100]
    # sorted newest-first by release date, scoped to games (category1=998)
    assert route.calls.last.request.url.params["sort_by"] == "Released_DESC"
    assert route.calls.last.request.url.params["category1"] == "998"
    # rows carry the new_release category
    assert all(r["category"] == "new_release" for r in rows)


@respx.mock
def test_fetch_new_releases_dedupes_across_pages_and_reranks():
    payload = json.loads(FIX_NEW.read_text(encoding="utf-8"))
    route = respx.get(f"{STORE_BASE}/search/results/").mock(
        return_value=httpx.Response(200, json=payload)
    )
    with httpx.Client() as c:
        rows = fetch_new_releases(c)

    # both pages return the same 2 games → de-duped to 2, ranks 0..1
    assert route.called
    assert [r["app_id"] for r in rows] == [111, 222]
    assert [r["rank"] for r in rows] == [0, 1]
