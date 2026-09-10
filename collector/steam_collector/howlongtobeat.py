"""HowLongToBeat playtime estimates (unofficial, undocumented).

Best-effort: HLTB has no public API. We replay the site's own internal search
request, which is anti-bot protected. The flow (as of mid-2026) is two steps:

  1. GET  /api/bleed/init?t=<ms>  -> {"token", "hpKey", "hpVal"}  (honeypot guard)
  2. POST /api/bleed  with headers x-auth-token / x-hp-key / x-hp-val, and the
     same hpKey:hpVal pair injected into the JSON body. The token rotates and a
     stale one returns HTTP 403.

Times in the response are in SECONDS (comp_main / comp_plus / comp_100). We
convert to whole hours. Treat as cache-last-good; the endpoint is fragile, so
fetch_hltb swallows everything and returns None on any failure.
"""
import re
import httpx

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
_BASE = "https://howlongtobeat.com"
_HEADERS = {
    "User-Agent": _UA,
    "Referer": _BASE + "/",
    "Origin": _BASE,
    "Content-Type": "application/json",
}


def _secs_to_hours(secs) -> int | None:
    """HLTB stores 0 for 'no data'. Treat 0/missing as None, else round to hours."""
    if not secs:
        return None
    return round(secs / 3600)


def _normalize(name: str) -> str:
    """Lowercase, drop punctuation, collapse whitespace for fuzzy name matching."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", name.lower())).strip()


def parse_hltb_results(payload: dict) -> list[dict]:
    """Pure: map the search response 'data' list into hour-based dicts."""
    out = []
    for g in payload.get("data", []) or []:
        out.append({
            "name": g.get("game_name"),
            "main": _secs_to_hours(g.get("comp_main")),
            "extra": _secs_to_hours(g.get("comp_plus")),
            "completionist": _secs_to_hours(g.get("comp_100")),
        })
    return out


def best_match(results: list[dict], query: str) -> dict | None:
    """Pure: prefer an exact normalized-name match, else the first result."""
    if not results:
        return None
    q = _normalize(query)
    for r in results:
        if r.get("name") and _normalize(r["name"]) == q:
            return r
    return results[0]


def _init_security(client: httpx.Client) -> dict:
    """Step 1: grab the rotating search token + honeypot key/value pair."""
    import time
    resp = client.get(f"{_BASE}/api/bleed/init?t={int(time.time() * 1000)}", headers=_HEADERS)
    resp.raise_for_status()
    return resp.json()


def fetch_hltb(client: httpx.Client, name: str) -> dict | None:
    """Best-effort live lookup. Returns {main, extra, completionist} hours, or None.

    Wraps the whole anti-bot dance in try/except: the endpoint is undocumented
    and fragile (token rotation, honeypot, 403s), so any failure -> None and the
    caller stores cache-last-good rather than crashing the collector run.
    """
    try:
        sec = _init_security(client)
        token, hp_key, hp_val = sec["token"], sec["hpKey"], sec["hpVal"]
        body = {
            "searchType": "games",
            "searchTerms": name.strip().split(" "),
            "searchPage": 1,
            "size": 20,
            "searchOptions": {
                "games": {
                    "userId": 0, "platform": "", "sortCategory": "popular",
                    "rangeCategory": "main", "rangeTime": {"min": None, "max": None},
                    "gameplay": {"perspective": "", "flow": "", "genre": "", "difficulty": ""},
                    "rangeYear": {"min": "", "max": ""}, "modifier": "",
                },
                "users": {"sortCategory": "postcount"},
                "lists": {"sortCategory": "follows"},
                "filter": "", "sort": 0, "randomizer": 0,
            },
            "useCache": True,
        }
        body[hp_key] = hp_val  # honeypot pair must also live in the body
        headers = {**_HEADERS, "x-auth-token": token, "x-hp-key": hp_key, "x-hp-val": hp_val}
        resp = client.post(f"{_BASE}/api/bleed", headers=headers, json=body)
        resp.raise_for_status()
        match = best_match(parse_hltb_results(resp.json()), name)
        if not match:
            return None
        return {"main": match["main"], "extra": match["extra"], "completionist": match["completionist"]}
    except Exception:
        return None
