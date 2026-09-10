"""Valve's official Steam Deck compatibility rating (undocumented store endpoint).

Complements ProtonDB's community Linux tier with Valve's own Verified/Playable/
Unsupported badge. resolved_category: 3=Verified, 2=Playable, 1=Unsupported, 0=Unknown.
"""
import httpx

_UA = {"User-Agent": "SteamCommandCenter/1.0 (+https://steam-hub-flax.vercel.app)"}
_CAT = {3: "verified", 2: "playable", 1: "unsupported"}


def parse_deck_compat(payload: dict) -> str | None:
    cat = (payload.get("results") or {}).get("resolved_category")
    return _CAT.get(cat)


def fetch_deck_compat(client: httpx.Client, app_id: int) -> str | None:
    resp = client.get(
        "https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport",
        params={"nAppID": app_id, "l": "english"}, headers=_UA)
    if resp.status_code != 200:
        return None
    return parse_deck_compat(resp.json())
