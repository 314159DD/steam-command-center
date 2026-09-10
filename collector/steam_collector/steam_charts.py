"""Steam's official 'Most Played' charts - the same ranking SteamDB shows.

We only poll live player counts for games we already track (discovery + user
libraries), so the true global top games (CS2, Dota 2, PUBG, ...) never showed
up. This pulls the official ranked app list so those games get tracked + polled
for live concurrent counts like everything else.
"""
import httpx
from steam_collector.config import API_BASE


def parse_most_played(payload: dict) -> list[dict]:
    ranks = (payload.get("response") or {}).get("ranks") or []
    rows: list[dict] = []
    for r in ranks:
        app_id = r.get("appid")
        if not app_id:
            continue
        rows.append({"app_id": app_id, "rank": r.get("rank"), "peak": r.get("peak_in_game")})
    return rows


def fetch_most_played(client: httpx.Client) -> list[dict]:
    resp = client.get(f"{API_BASE}/ISteamChartsService/GetMostPlayedGames/v1/")
    resp.raise_for_status()
    return parse_most_played(resp.json())
