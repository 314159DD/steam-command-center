"""OpenCritic public release calendar (free .ics feed) → upcoming game releases.

Steam only exposes vague "Coming soon" for most unreleased games, so the wishlist
calendar was near-empty. This pulls real dated upcoming releases from OpenCritic's
public iCal feed (no API key needed - the OpenCritic REST API is paid/RapidAPI).
"""
import re
from datetime import date
import httpx

_UA = {"User-Agent": "SteamCommandCenter/1.0 (+https://steam-hub-flax.vercel.app)"}
_FEED = "https://img.opencritic.com/calendar/OpenCritic.ics"

_EVENT = re.compile(r"BEGIN:VEVENT(.*?)END:VEVENT", re.DOTALL)
_DATE = re.compile(r"DTSTART[^:]*:(\d{8})")
_SUMMARY = re.compile(r"\nSUMMARY:(.+)")
_URL = re.compile(r"\nURL[^:]*:(\S+)")


def _unfold(text: str) -> str:
    """iCal folds long lines as CRLF + leading space/tab - join them back."""
    return re.sub(r"\r?\n[ \t]", "", text)


def parse_ics(text: str, today: str) -> list[dict]:
    """Upcoming events (DTSTART >= today 'YYYYMMDD') as [{name, date(ISO), url}], sorted."""
    text = _unfold(text)
    out: list[dict] = []
    for m in _EVENT.finditer(text):
        b = m.group(1)
        d, s, u = _DATE.search(b), _SUMMARY.search(b), _URL.search(b)
        if not (d and s) or d.group(1) < today:
            continue
        name = s.group(1).strip()
        if name.endswith(" Release"):
            name = name[: -len(" Release")]
        ymd = d.group(1)
        out.append({"name": name, "date": f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}", "url": u.group(1).strip() if u else None})
    out.sort(key=lambda e: e["date"])
    return out


def fetch_calendar(client: httpx.Client, today: str | None = None) -> list[dict]:
    today = today or date.today().strftime("%Y%m%d")
    resp = client.get(_FEED, headers=_UA, follow_redirects=True)
    resp.raise_for_status()
    return parse_ics(resp.text, today)
