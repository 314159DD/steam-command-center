"""Steam review histogram (undocumented store endpoint) → recent review momentum.

Compares the last ~30 days of review sentiment against the lifetime rollups to
flag whether a game's reviews are currently trending up/down/flat. Feeds the
hero feed ("this patch fixed/tanked reviews").
"""
import httpx

_UA = {"User-Agent": "SteamCommandCenter/1.0 (+https://steam-hub-flax.vercel.app)"}
_THRESHOLD = 5  # percentage points of divergence to count as a trend


def _pct(up: int, down: int) -> int | None:
    total = up + down
    return round(up / total * 100) if total else None


def parse_review_histogram(payload: dict) -> dict:
    res = payload.get("results") or {}
    recent = res.get("recent") or []
    rollups = res.get("rollups") or []
    ru = sum(r.get("recommendations_up", 0) for r in recent)
    rd = sum(r.get("recommendations_down", 0) for r in recent)
    ou = sum(r.get("recommendations_up", 0) for r in rollups)
    od = sum(r.get("recommendations_down", 0) for r in rollups)
    recent_pct = _pct(ru, rd)
    overall_pct = _pct(ou, od)
    trend = None
    if recent_pct is not None and overall_pct is not None:
        if recent_pct >= overall_pct + _THRESHOLD:
            trend = "up"
        elif recent_pct <= overall_pct - _THRESHOLD:
            trend = "down"
        else:
            trend = "flat"
    return {"recent_up": ru, "recent_down": rd, "recent_pct": recent_pct,
            "overall_pct": overall_pct, "trend": trend}


def fetch_review_histogram(client: httpx.Client, app_id: int) -> dict | None:
    resp = client.get(f"https://store.steampowered.com/appreviewhistogram/{app_id}",
                      params={"l": "english"}, headers=_UA)
    if resp.status_code != 200:
        return None
    return parse_review_histogram(resp.json())
