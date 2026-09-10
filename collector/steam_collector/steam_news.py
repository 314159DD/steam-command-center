import re
import httpx
from datetime import datetime, timezone
from steam_collector.config import API_BASE

_IMG_TAG = re.compile(r"\[img\].*?\[/img\]", re.DOTALL)
_BBCODE = re.compile(r"\[/?[^\]]+\]")
_WS = re.compile(r"\s+")


def strip_bbcode(text: str) -> str:
    text = text or ""
    # Remove image tags with their content first
    text = _IMG_TAG.sub("", text)
    # Remove other BBCode tags
    text = _BBCODE.sub("", text)
    # Collapse whitespace and strip
    return _WS.sub(" ", text).strip()


def _to_iso(ts) -> str | None:
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def fetch_news(client: httpx.Client, app_id: int, count: int = 5) -> list[dict]:
    resp = client.get(
        f"{API_BASE}/ISteamNews/GetNewsForApp/v2/",
        params={"appid": app_id, "count": count, "maxlength": 1500},
    )
    resp.raise_for_status()
    items = resp.json().get("appnews", {}).get("newsitems", [])
    return [{
        "gid": it["gid"],
        "app_id": app_id,
        "title": it.get("title", ""),
        "body": strip_bbcode(it.get("contents", "")),
        "url": it.get("url"),
        "posted_at": _to_iso(it.get("date")),
    } for it in items]
