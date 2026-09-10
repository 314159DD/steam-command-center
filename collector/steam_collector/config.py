import os
from dotenv import load_dotenv

load_dotenv()

STEAM_API_KEY = os.environ.get("STEAM_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
COLLECT_INTERVAL_SECONDS = int(os.environ.get("COLLECT_INTERVAL_SECONDS", "1800"))
ITAD_API_KEY = os.environ.get("ITAD_API_KEY", "")
STORE_BASE = "https://store.steampowered.com"
API_BASE = "https://api.steampowered.com"
TWITCH_CLIENT_ID = os.environ.get("TWITCH_CLIENT_ID", "")
TWITCH_CLIENT_SECRET = os.environ.get("TWITCH_CLIENT_SECRET", "")
IGDB_BASE = "https://api.igdb.com/v4"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
