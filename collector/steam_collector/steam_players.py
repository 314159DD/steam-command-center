import httpx

from steam_collector.config import API_BASE


def fetch_player_count(client: httpx.Client, app_id: int) -> int | None:
    resp = client.get(
        f"{API_BASE}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/",
        params={"appid": app_id},
    )
    resp.raise_for_status()
    data = resp.json().get("response", {})
    if data.get("result") != 1:
        return None
    return data.get("player_count")
