"""Parse Steam's store search 'New & Trending' results into snapshot rows.

`featuredcategories` (see steam_store.py) has no trending section, so the
dashboard's TRENDING column has no source without this. We hit the store
search endpoint with `filter=popularnew` and pull app ids + names out of the
`results_html` blob it returns. header_image / price are left null here and get
backfilled by the catalog enrichment pass (steam_catalog.enrich_game).
"""
import html
import re
import httpx
from steam_collector.config import STORE_BASE

# Each search result row carries data-ds-appid (single id, or a comma list for
# bundles), an optional capsule <img>, then a <span class="title">. Non-greedy so
# we bind the appid to the nearest following image/title within the same row.
_ROW = re.compile(
    r'data-ds-appid="(\d+)(?:.*?<img[^>]+src="([^"]+)")?.*?<span class="title">(.*?)</span>',
    re.DOTALL)


def _parse_results(results_html: str, category: str) -> list[dict]:
    rows: list[dict] = []
    for rank, m in enumerate(_ROW.finditer(results_html)):
        rows.append({
            "app_id": int(m.group(1)),
            "category": category,
            "rank": rank,
            "name": html.unescape(m.group(3)).strip(),
            "header_image": m.group(2),
            "price_cents": None,
        })
    return rows


def parse_trending(payload: dict) -> list[dict]:
    """Flatten a search results_html payload into normalized 'trending' rows."""
    return _parse_results(payload.get("results_html") or "", "trending")


def _fetch_search(
    client: httpx.Client,
    category: str,
    *,
    store_filter: str | None = None,
    sort_by: str = "_ASC",
    start: int = 0,
    count: int = 50,
    extra_params: dict | None = None,
) -> list[dict]:
    params = {
        "query": "",
        "start": start,
        "count": count,
        "dynamic_data": "",
        "sort_by": sort_by,
        "infinite": 1,
        "json": 1,
        "cc": "DE",
        "l": "english",
    }
    if store_filter is not None:
        params["filter"] = store_filter
    if extra_params:
        params.update(extra_params)
    resp = client.get(f"{STORE_BASE}/search/results/", params=params)
    resp.raise_for_status()
    return _parse_results(resp.json().get("results_html") or "", category)


def fetch_trending(client: httpx.Client) -> list[dict]:
    """Fetch + parse Steam's 'New & Trending' search results."""
    return _fetch_search(client, "trending", store_filter="popularnew")


def fetch_top_sellers(client: httpx.Client) -> list[dict]:
    """Fetch + parse Steam's 'Top Sellers' search results (more than featuredcategories gives)."""
    return _fetch_search(client, "top_seller", store_filter="topsellers")


def fetch_new_releases(client: httpx.Client, pages: int = 2) -> list[dict]:
    """Fetch the newest games by release date (category1=998 'Games', sorted Released_DESC).

    Paginates the store search (default 2 pages of 100 = ~200 newest games) so the
    NEW RELEASES column is purely newest-by-date, independent of Valve's curated
    featuredcategories 'new_releases'. Ranks are global across pages; de-duped on
    app_id (first occurrence wins).
    """
    seen: set[int] = set()
    rows: list[dict] = []
    for page in range(pages):
        page_rows = _fetch_search(
            client,
            "new_release",
            sort_by="Released_DESC",
            start=page * 100,
            count=100,
            extra_params={"category1": 998},
        )
        for r in page_rows:
            if r["app_id"] in seen:
                continue
            seen.add(r["app_id"])
            r["rank"] = len(rows)
            rows.append(r)
    return rows
