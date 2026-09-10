from steam_collector.steam_catalog import parse_appdetails, parse_review_summary

def test_parse_appdetails_maps_genres_to_tags_and_price():
    payload = {"570": {"success": True, "data": {
        "name": "Dota 2",
        "header_image": "h.jpg",
        "genres": [{"id": "1", "description": "Action"}, {"id": "2", "description": "Strategy"}],
        "release_date": {"coming_soon": False, "date": "2013"},
        "price_overview": {"final": 0},
    }}}
    row = parse_appdetails(payload, 570)
    assert row["app_id"] == 570
    assert row["name"] == "Dota 2"
    assert row["tags"] == ["Action", "Strategy"]
    assert row["genres"] == ["Action", "Strategy"]
    assert row["is_released"] is True
    assert row["coming_soon"] is False
    assert row["release_date"] == "2013"
    assert row["price_cents"] == 0


def test_parse_appdetails_flags_coming_soon():
    payload = {"7": {"success": True, "data": {
        "name": "Soon", "release_date": {"coming_soon": True, "date": "Q3 2026"}}}}
    row = parse_appdetails(payload, 7)
    assert row["coming_soon"] is True and row["release_date"] == "Q3 2026" and row["is_released"] is False

def test_parse_appdetails_unsuccessful_returns_none():
    assert parse_appdetails({"999": {"success": False}}, 999) is None

def test_parse_review_summary_computes_percent():
    payload = {"query_summary": {"total_positive": 900, "total_negative": 100, "total_reviews": 1000}}
    s = parse_review_summary(payload)
    assert s["review_count"] == 1000
    assert s["review_score"] == 90

def test_parse_review_summary_zero_reviews_is_none_score():
    s = parse_review_summary({"query_summary": {"total_positive": 0, "total_negative": 0, "total_reviews": 0}})
    assert s["review_count"] == 0
    assert s["review_score"] is None


import datetime as _dt
from steam_collector.steam_catalog import parse_release_date


def test_parse_release_date_us_comma_format():
    assert parse_release_date("Jun 14, 2026") == _dt.date(2026, 6, 14)


def test_parse_release_date_euro_day_first_format():
    assert parse_release_date("17 Jul, 2025") == _dt.date(2025, 7, 17)


def test_parse_release_date_full_month_name():
    assert parse_release_date("14 June, 2026") == _dt.date(2026, 6, 14)


def test_parse_release_date_unparseable_returns_none():
    assert parse_release_date("Coming soon") is None
    assert parse_release_date("Q3 2026") is None
    assert parse_release_date("") is None
    assert parse_release_date(None) is None


def test_parse_appdetails_emits_released_at():
    payload = {"570": {"success": True, "data": {
        "name": "Dota 2", "header_image": "h.jpg", "genres": [{"description": "Action"}],
        "release_date": {"coming_soon": False, "date": "Jul 9, 2013"},
    }}}
    from steam_collector.steam_catalog import parse_appdetails
    row = parse_appdetails(payload, 570)
    assert row["released_at"] == _dt.date(2013, 7, 9)


from steam_collector.steam_catalog import (
    pick_developer, pick_trailer_movie_id, category_flags, pick_screenshots,
)

_DATA = {
    "developers": ["Valve"],
    "categories": [{"description": "Multi-player"}, {"description": "Valve Anti-Cheat enabled"}],
    "movies": [{"id": 100, "highlight": False}, {"id": 200, "highlight": True}],
    "screenshots": [{"path_thumbnail": "a.jpg"}, {"path_thumbnail": "b.jpg"},
                    {"path_thumbnail": "c.jpg"}, {"path_thumbnail": "d.jpg"}, {"path_thumbnail": "e.jpg"}],
}


def test_pick_developer():
    assert pick_developer(_DATA) == "Valve"
    assert pick_developer({}) is None


def test_pick_trailer_movie_id_prefers_highlight():
    assert pick_trailer_movie_id(_DATA) == 200          # highlight wins over order
    assert pick_trailer_movie_id({"movies": [{"id": 7}]}) == 7
    assert pick_trailer_movie_id({}) is None


def test_category_flags():
    assert category_flags(_DATA) == (True, False)        # VAC yes, family-sharing no
    fam = {"categories": [{"description": "Family Sharing"}]}
    assert category_flags(fam) == (False, True)
    assert category_flags({}) == (False, False)


def test_pick_screenshots_caps_at_n():
    assert pick_screenshots(_DATA) == ["a.jpg", "b.jpg", "c.jpg", "d.jpg"]
    assert pick_screenshots({}) == []


def test_parse_appdetails_emits_card_fields():
    payload = {"570": {"success": True, "data": {
        "name": "Dota 2", "header_image": "h.jpg", "genres": [{"description": "Action"}],
        "release_date": {"coming_soon": False, "date": "Jul 9, 2013"},
        "developers": ["Valve"],
        "categories": [{"description": "Valve Anti-Cheat enabled"}, {"description": "Family Sharing"}],
        "movies": [{"id": 999, "highlight": True}],
        "screenshots": [{"path_thumbnail": "s1.jpg"}],
    }}}
    from steam_collector.steam_catalog import parse_appdetails
    row = parse_appdetails(payload, 570)
    assert row["developer"] == "Valve"
    assert row["has_vac"] is True
    assert row["family_sharing"] is True
    assert row["trailer_movie_id"] == 999
    assert row["screenshots"] == ["s1.jpg"]
