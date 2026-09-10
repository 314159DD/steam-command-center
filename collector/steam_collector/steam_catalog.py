"""Enrich a game with tags/genres (appdetails) and review stats (appreviews)."""
import datetime
import httpx
from steam_collector.config import STORE_BASE

# Steam's release_date string is free-text and inconsistent across locales.
# Known shapes: "Jun 14, 2026", "17 Jul, 2025", "14 June, 2026". Anything we
# can't confidently parse (e.g. "Coming soon", "Q3 2026") -> None.
_RELEASE_DATE_FORMATS = ("%b %d, %Y", "%d %b, %Y", "%d %B, %Y", "%B %d, %Y")


def parse_release_date(value: str | None) -> datetime.date | None:
    if not value:
        return None
    text = value.strip()
    for fmt in _RELEASE_DATE_FORMATS:
        try:
            return datetime.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def pick_developer(data: dict) -> str | None:
    devs = data.get("developers") or []
    return devs[0] if devs else None


def pick_trailer_movie_id(data: dict) -> int | None:
    """First movie id, preferring one flagged highlight (the store hover trailer)."""
    movies = data.get("movies") or []
    if not movies:
        return None
    for m in movies:
        if m.get("highlight"):
            return m.get("id")
    return movies[0].get("id")


def category_flags(data: dict) -> tuple[bool, bool]:
    """(has_vac, family_sharing) from the categories list."""
    descs = {c.get("description") for c in (data.get("categories") or [])}
    return ("Valve Anti-Cheat enabled" in descs, "Family Sharing" in descs)


def pick_screenshots(data: dict, n: int = 4) -> list[str]:
    return [s["path_thumbnail"] for s in (data.get("screenshots") or [])[:n] if s.get("path_thumbnail")]


def parse_appdetails(payload: dict, app_id: int) -> dict | None:
    entry = payload.get(str(app_id))
    if not entry or not entry.get("success"):
        return None
    data = entry.get("data", {})
    genres = [g["description"] for g in data.get("genres", []) if g.get("description")]
    price = data.get("price_overview", {}).get("final")
    rd = data.get("release_date") or {}
    coming_soon = bool(rd.get("coming_soon", False))
    has_vac, family_sharing = category_flags(data)
    return {
        "app_id": app_id,
        "name": data.get("name", ""),
        "header_image": data.get("header_image"),
        "genres": genres,
        "tags": genres,  # v1: genres double as tags; refine later if needed
        "is_released": not coming_soon,
        "coming_soon": coming_soon,
        "release_date": rd.get("date"),
        "released_at": parse_release_date(rd.get("date")),
        "price_cents": price,
        "developer": pick_developer(data),
        "has_vac": has_vac,
        "family_sharing": family_sharing,
        "trailer_movie_id": pick_trailer_movie_id(data),
        "screenshots": pick_screenshots(data),
    }


def parse_review_summary(payload: dict) -> dict:
    qs = payload.get("query_summary", {})
    total = qs.get("total_reviews", 0)
    positive = qs.get("total_positive", 0)
    score = round(positive / total * 100) if total > 0 else None
    return {"review_count": total, "review_score": score}


def enrich_game(client: httpx.Client, app_id: int) -> dict | None:
    """Combined enrichment row ready for a games upsert. None if appdetails fails."""
    d = client.get(f"{STORE_BASE}/api/appdetails",
                   params={"appids": app_id, "cc": "us", "l": "english"})
    d.raise_for_status()
    details = parse_appdetails(d.json(), app_id)
    if details is None:
        return None
    r = client.get(f"{STORE_BASE}/appreviews/{app_id}",
                   params={"json": 1, "num_per_page": 0, "language": "all"})
    r.raise_for_status()
    details.update(parse_review_summary(r.json()))
    return details
