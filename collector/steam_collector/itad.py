"""IsThereAnyDeal price intelligence: current best price + all-time low.

Two batched calls: appid -> ITAD game id (Steam shop = 61), then prices/v3 for
many ids at once. Respect 1000 req / 5 min; keep ITAD links/data intact (ToS).
"""
import re
import httpx

BASE = "https://api.isthereanydeal.com"
_UA = {"User-Agent": "SteamCommandCenter/1.0 (+https://steam-hub-flax.vercel.app)"}

MAX_IDS_PER_REQUEST = 200


def redact_key(text: str) -> str:
    """Replace key=<value> in a URL query string with key=REDACTED."""
    return re.sub(r"((?:^|[?&])key=)[^&]+", r"\1REDACTED", text)


def lookup_itad_ids(client: httpx.Client, key: str, app_ids: list[int]) -> dict[int, str]:
    """Batch-resolve Steam appids -> ITAD game ids. Drops unmatched (null) ids."""
    resp = client.post(f"{BASE}/lookup/id/shop/61/v1", params={"key": key},
                       json=[f"app/{a}" for a in app_ids], headers=_UA)
    resp.raise_for_status()
    out: dict[int, str] = {}
    for shop_id, itad_id in resp.json().items():
        if itad_id:
            out[int(shop_id.split("/")[1])] = itad_id
    return out


def parse_prices(payload: list) -> dict[str, dict]:
    """Map ITAD prices/v3 response -> {itad_id: {price_cents, shop, cut, atl_cents, currency}}."""
    out: dict[str, dict] = {}
    for row in payload:
        deals = row.get("deals") or []
        cheapest = min(deals, key=lambda d: d["price"]["amountInt"]) if deals else None
        atl = (row.get("historyLow") or {}).get("all") or {}
        out[row["id"]] = {
            "price_cents": cheapest["price"]["amountInt"] if cheapest else None,
            "shop": cheapest["shop"]["name"] if cheapest else None,
            "cut": cheapest.get("cut", 0) if cheapest else None,
            "atl_cents": atl.get("amountInt"),
            "currency": atl.get("currency") or (cheapest["price"]["currency"] if cheapest else None),
        }
    return out


def fetch_prices(client: httpx.Client, key: str, itad_ids: list[str], country: str = "DE") -> dict[str, dict]:
    if not itad_ids:
        return {}
    out: dict[str, dict] = {}
    for i in range(0, len(itad_ids), MAX_IDS_PER_REQUEST):
        batch = itad_ids[i:i + MAX_IDS_PER_REQUEST]
        resp = client.post(f"{BASE}/games/prices/v3", params={"key": key, "country": country},
                           json=batch, headers=_UA)
        resp.raise_for_status()
        out.update(parse_prices(resp.json()))
    return out


_SCORE_SRC = {"Metascore": "metacritic", "Metacritic User Score": "metacritic_user", "OpenCritic": "opencritic"}


def parse_game_info(payload: dict) -> dict:
    """Pull critic scores (Metacritic critic+user, OpenCritic) from /games/info/v2."""
    out = {"metacritic": None, "metacritic_user": None, "opencritic": None}
    for rv in payload.get("reviews") or []:
        key = _SCORE_SRC.get(rv.get("source"))
        if key:
            out[key] = rv.get("score")
    return out


def parse_bundles(payload: list) -> dict:
    """{count, name} of bundles a game is currently in (name = 'Shop: Bundle title')."""
    if not payload:
        return {"count": 0, "name": None}
    first = payload[0]
    shop = (first.get("page") or {}).get("name") or "Bundle"
    return {"count": len(payload), "name": f"{shop}: {first.get('title', '')}"}


def fetch_bundles(client: httpx.Client, key: str, itad_id: str, country: str = "DE") -> dict:
    resp = client.get(f"{BASE}/games/bundles/v2", params={"key": key, "id": itad_id, "country": country}, headers=_UA)
    if resp.status_code != 200:
        return {"count": 0, "name": None}
    return parse_bundles(resp.json())


def parse_subs(payload: list) -> dict[str, list]:
    """{itad_id: [subscription names]} from /games/subs/v1 (e.g. ['Game Pass'])."""
    out: dict[str, list] = {}
    for row in payload:
        out[row["id"]] = [s["name"] for s in (row.get("subs") or []) if s.get("name")]
    return out


def fetch_subs(client: httpx.Client, key: str, itad_ids: list[str], country: str = "DE") -> dict[str, list]:
    if not itad_ids:
        return {}
    out: dict[str, list] = {}
    for i in range(0, len(itad_ids), MAX_IDS_PER_REQUEST):
        batch = itad_ids[i:i + MAX_IDS_PER_REQUEST]
        resp = client.post(f"{BASE}/games/subs/v1", params={"key": key, "country": country},
                           json=batch, headers=_UA)
        resp.raise_for_status()
        out.update(parse_subs(resp.json()))
    return out


def detect_price_drops(old_map: dict, new_rows: list[dict]) -> list[dict]:
    """Compare new prices to the previously-stored ones; emit a drop event per genuine decrease.

    old_map: {app_id: (old_price_cents, old_atl_cents)}. Returns events with at_atl set
    when the new price reached the all-time low.
    """
    drops = []
    for r in new_rows:
        aid = r["app_id"]
        new = r.get("price_cents")
        atl = r.get("atl_cents")
        old = old_map.get(aid, (None, None))[0]
        if old is not None and new is not None and new > 0 and new < old:
            drops.append({"app_id": aid, "old_cents": old, "new_cents": new,
                          "at_atl": atl is not None and new <= atl})
    return drops


def fetch_game_info(client: httpx.Client, key: str, itad_id: str) -> dict | None:
    """Per-game info (stable endpoint). Returns critic scores or None on error."""
    resp = client.get(f"{BASE}/games/info/v2", params={"key": key, "id": itad_id}, headers=_UA)
    if resp.status_code != 200:
        return None
    return parse_game_info(resp.json())
