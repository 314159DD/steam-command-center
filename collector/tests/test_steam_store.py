import json, pathlib
from steam_collector.steam_store import parse_featured

FIX = pathlib.Path(__file__).parent / "fixtures" / "featuredcategories.json"

def test_parse_featured_maps_categories_and_prices():
    payload = json.loads(FIX.read_text())
    rows = parse_featured(payload)
    by_app = {(r["app_id"], r["category"]): r for r in rows}

    # new_release is intentionally NOT emitted from featuredcategories anymore -
    # the NEW RELEASES column is sourced from newest-by-date search instead.
    assert (300, "new_release") not in by_app
    assert not any(r["category"] == "new_release" for r in rows)
    assert (200, "top_seller") in by_app
    assert (100, "special") in by_app

    special = by_app[(100, "special")]
    assert special["name"] == "Cyber Hollow"
    assert special["price_cents"] == 2999
    assert special["rank"] == 0
    assert special["header_image"] == "h100.jpg"


def test_parse_featured_falls_back_to_capsule_when_header_missing():
    payload = {"top_sellers": {"items": [
        {"id": 999, "name": "NoHeader", "large_capsule_image": "lc.jpg", "small_capsule_image": "sc.jpg"},
    ]}}
    rows = parse_featured(payload)
    assert rows[0]["header_image"] == "lc.jpg"
