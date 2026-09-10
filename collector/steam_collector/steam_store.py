"""Parse Steam's undocumented store /api/featuredcategories payload."""
import httpx
from steam_collector.config import STORE_BASE

# Steam category key -> our normalized category name.
# NOTE: 'new_releases' is intentionally omitted - the NEW RELEASES column is now
# sourced purely from newest-by-release-date search (steam_trending.fetch_new_releases),
# not Valve's curated featuredcategories block.
_CATEGORY_MAP = {
    "top_sellers": "top_seller",
    "specials": "special",
    "coming_soon": "upcoming",
}


def parse_featured(payload: dict) -> list[dict]:
    """Flatten featuredcategories JSON into normalized snapshot rows."""
    rows: list[dict] = []
    for steam_key, category in _CATEGORY_MAP.items():
        block = payload.get(steam_key)
        if not isinstance(block, dict):
            continue
        for rank, item in enumerate(block.get("items", [])):
            app_id = item.get("id")
            if not app_id:
                continue
            rows.append({
                "app_id": app_id,
                "category": category,
                "rank": rank,
                "name": item.get("name", ""),
                "header_image": (item.get("header_image")
                                 or item.get("large_capsule_image")
                                 or item.get("small_capsule_image")),
                "price_cents": item.get("final_price"),
                "discount_percent": item.get("discount_percent", 0),
            })
    return rows


def fetch_featured(client: httpx.Client) -> list[dict]:
    """Fetch + parse live featured categories."""
    resp = client.get(f"{STORE_BASE}/api/featuredcategories", params={"cc": "DE", "l": "english"})
    resp.raise_for_status()
    return parse_featured(resp.json())
