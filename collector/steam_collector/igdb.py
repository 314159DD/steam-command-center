"""IGDB (Twitch) enrichment: anticipation (hypes/follows) + an independent critic
score (aggregated_rating) for recent Steam releases.

Auth is Twitch client-credentials -> bearer token. Steam appids are matched exactly
via IGDB external_games (external_game_source 1 = Steam, uid = the appid as a string).
NOTE: IGDB deprecated the old `category` field on external_games in favour of
`external_game_source`; filtering on `category` returns nothing for Steam. Official
free API; keep batches <= 500 and a descriptive intent. Collector-only.
"""
import httpx
from steam_collector.config import IGDB_BASE, TWITCH_TOKEN_URL

MAX_IDS_PER_REQUEST = 500
_STEAM_SOURCE = 1  # external_game_source id for Steam


def get_igdb_token(client: httpx.Client, client_id: str, client_secret: str) -> str:
    resp = client.post(TWITCH_TOKEN_URL, params={
        "client_id": client_id, "client_secret": client_secret,
        "grant_type": "client_credentials"})
    resp.raise_for_status()
    return resp.json()["access_token"]


def _headers(client_id: str, token: str) -> dict:
    return {"Client-ID": client_id, "Authorization": f"Bearer {token}",
            "Accept": "application/json"}


def parse_external_games(payload: list) -> dict[int, int]:
    """[{game, uid}] -> {steam_appid: igdb_game_id}."""
    out: dict[int, int] = {}
    for row in payload:
        uid, game = row.get("uid"), row.get("game")
        if uid is None or game is None:
            continue
        try:
            out[int(uid)] = int(game)
        except (TypeError, ValueError):
            continue
    return out


def parse_games(payload: list) -> dict[int, dict]:
    """[{id, hypes, follows, aggregated_rating, aggregated_rating_count}] -> {game_id: {...}}."""
    out: dict[int, dict] = {}
    for row in payload:
        out[row["id"]] = {
            "hypes": row.get("hypes"),
            "follows": row.get("follows"),
            "aggregated_rating": row.get("aggregated_rating"),
            "aggregated_rating_count": row.get("aggregated_rating_count"),
        }
    return out


def _post(client: httpx.Client, client_id: str, token: str, path: str, body: str) -> list:
    resp = client.post(f"{IGDB_BASE}/{path}", headers=_headers(client_id, token), content=body)
    resp.raise_for_status()
    return resp.json()


def fetch_igdb(client: httpx.Client, client_id: str, token: str, app_ids: list[int]) -> dict[int, dict]:
    """Resolve appids -> IGDB ids, then fetch signals. {appid: {igdb_id, hypes, follows,
    aggregated_rating, aggregated_rating_count}} for matched appids only."""
    if not app_ids:
        return {}
    appid_to_game: dict[int, int] = {}
    for i in range(0, len(app_ids), MAX_IDS_PER_REQUEST):
        chunk = app_ids[i:i + MAX_IDS_PER_REQUEST]
        ids = ",".join(f'"{a}"' for a in chunk)
        body = f"fields game,uid; where external_game_source = {_STEAM_SOURCE} & uid = ({ids}); limit {MAX_IDS_PER_REQUEST};"
        appid_to_game.update(parse_external_games(_post(client, client_id, token, "external_games", body)))
    if not appid_to_game:
        return {}
    game_ids = sorted(set(appid_to_game.values()))
    signals: dict[int, dict] = {}
    for i in range(0, len(game_ids), MAX_IDS_PER_REQUEST):
        chunk = game_ids[i:i + MAX_IDS_PER_REQUEST]
        ids = ",".join(str(g) for g in chunk)
        body = (f"fields hypes,follows,aggregated_rating,aggregated_rating_count; "
                f"where id = ({ids}); limit {MAX_IDS_PER_REQUEST};")
        signals.update(parse_games(_post(client, client_id, token, "games", body)))
    out: dict[int, dict] = {}
    for appid, game_id in appid_to_game.items():
        s = signals.get(game_id)
        if s is not None:
            out[appid] = {"igdb_id": game_id, **s}
    return out
