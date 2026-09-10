"""SteamSpy ownership estimates + tag votes. Rate limit: 1 req/s (per their docs)."""
import httpx

_UA = {"User-Agent": "SteamCommandCenter/1.0 (+https://steam-hub-flax.vercel.app)"}


def parse_spy_appdetails(payload: dict) -> dict:
    tags = payload.get("tags")
    return {
        "owners": payload.get("owners"),
        "ccu": payload.get("ccu"),
        "avg_playtime": payload.get("average_forever"),
        "median_playtime": payload.get("median_forever"),
        "tags": tags if isinstance(tags, dict) else {},
    }


def fetch_spy_appdetails(client: httpx.Client, app_id: int) -> dict | None:
    resp = client.get("https://steamspy.com/api.php",
                      params={"request": "appdetails", "appid": app_id}, headers=_UA)
    resp.raise_for_status()
    return parse_spy_appdetails(resp.json())
