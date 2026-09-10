"""ProtonDB Linux/Steam Deck compatibility summaries (unofficial, undocumented).

Best-effort: the endpoint is undocumented and 404s for games with no reports.
Treat as cache-last-good; callers store 'unrated' on None so we don't refetch.
"""
import httpx

_UA = {"User-Agent": "SteamCommandCenter/1.0 (+https://steam-hub-flax.vercel.app)"}


def parse_proton_summary(payload: dict) -> dict:
    return {
        "tier": payload.get("tier"),
        "trending_tier": payload.get("trendingTier"),
        "confidence": payload.get("confidence"),
        "score": payload.get("score"),
        "total": payload.get("total"),
    }


def fetch_proton_summary(client: httpx.Client, app_id: int) -> dict | None:
    """Return the compat summary, or None when the game has no ProtonDB reports."""
    resp = client.get(f"https://www.protondb.com/api/v1/reports/summaries/{app_id}.json", headers=_UA)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return parse_proton_summary(resp.json())
