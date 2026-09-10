#!/usr/bin/env python3
"""PICS build/patch watcher (Phase C / B12).

Watches Steam PICS for public-branch build-id changes on tracked apps and records
them in `build_history` (+ games.current_build_id). This is the SteamDB-style
"new build dropped" signal - there is NO public API for it, so it requires a
logged-in Steam account and a persistent host.

⚠ Run on a PERSISTENT host (e.g. the VPS) with a DEDICATED throwaway Steam account
   (NOT your main). See collector/PICS-RUNBOOK.md. Keep it polite: one session,
   a sane poll interval. Read-only metadata, but it's a ToS gray area.

Auth: Steam retired the legacy login-key/sentry persistence this library uses, so an
unattended login can't be cached. Enable the mobile authenticator once via
enroll_authenticator.py; the worker then logs in non-interactively with a TOTP code.

Env: STEAM_WATCHER_USERNAME, STEAM_WATCHER_PASSWORD (required for the service),
STEAM_GUARD_SHARED_SECRET (optional; otherwise read from the authenticator file in
PICS_CRED_DIR), DATABASE_URL, PICS_POLL_SECONDS (default 120), PICS_CRED_DIR
(default ~/.steam-watcher). With no shared secret at a TTY, falls back to interactive login.
"""
import json
import os
import sys
import psycopg

from gevent.timeout import Timeout  # NB: subclass of BaseException, not Exception
from steam.client import SteamClient  # ValvePython/steam - see requirements-pics.txt
from steam.enums import EResult
from steam_collector.config import DATABASE_URL
from steam_collector.pics import extract_builds, detect_build_changes

POLL_SECONDS = int(os.environ.get("PICS_POLL_SECONDS", "120"))
BATCH = 300


def tracked_apps(conn) -> list[int]:
    return [r[0] for r in conn.execute("select app_id from games").fetchall()]


def stored_builds(conn, app_ids: list[int]) -> dict:
    if not app_ids:
        return {}
    rows = conn.execute(
        "select app_id, current_build_id from games where app_id = any(%s) and current_build_id is not null",
        (app_ids,)).fetchall()
    return {r[0]: r[1] for r in rows}


def write_changes(conn, changes: list[dict]) -> None:
    if not changes:
        return
    with conn.cursor() as cur:
        cur.executemany("insert into build_history (app_id, build_id) values (%(app_id)s, %(build_id)s)", changes)
        cur.executemany("update games set current_build_id = %(build_id)s where app_id = %(app_id)s", changes)


def product_builds(client: "SteamClient", app_ids: list[int]) -> dict:
    out: dict[int, str] = {}
    for i in range(0, len(app_ids), BATCH):
        info = client.get_product_info(apps=app_ids[i:i + BATCH])
        out.update(extract_builds(info))
    return out


def _read_shared_secret(username: str, cred_dir: str) -> "str | None":
    """TOTP shared secret from env, else the authenticator file written at enrollment."""
    secret = os.environ.get("STEAM_GUARD_SHARED_SECRET")
    if secret:
        return secret.strip()
    auth_file = os.path.join(cred_dir, f"{username}_authenticator.json")
    try:
        with open(auth_file) as fh:
            return (json.load(fh).get("shared_secret") or "").strip() or None
    except (OSError, ValueError):
        return None


def _totp_login(client: "SteamClient", username: str, password: str, shared_secret: str) -> None:
    """Non-interactive login with a time-based Steam Guard code (mobile authenticator)."""
    from steam.guard import generate_twofactor_code
    last = None
    for _ in range(6):
        code = generate_twofactor_code(shared_secret)
        last = client.login(username, password, two_factor_code=code)
        if last == EResult.OK:
            print(f"[pics] logged in as {username} via mobile authenticator (TOTP)")
            return
        if last in (EResult.TwoFactorCodeMismatch, EResult.AccountLoginDeniedNeedTwoFactor):
            client.sleep(32)  # wait for the next 30s code window, then retry
            continue
        if last in (EResult.RateLimitExceeded, EResult.TryAnotherCM, EResult.ServiceUnavailable):
            client.sleep(30)
            continue
        break
    raise SystemExit(f"[pics] TOTP login failed (last result: {last!r}). Check password / shared_secret / clock.")


def steam_login(client: "SteamClient", username: str, password: "str | None") -> None:
    """TOTP-first login. Falls back to interactive only at a real terminal.

    Steam retired the legacy login-key + sentry persistence this library used, so an
    unattended service must authenticate fresh each time via the mobile authenticator's
    shared secret (no caching possible). See enroll_authenticator.py.
    """
    cred_dir = os.environ.get("PICS_CRED_DIR", os.path.expanduser("~/.steam-watcher"))
    os.makedirs(cred_dir, exist_ok=True)
    client.set_credential_location(cred_dir)  # caches the CM server list (harmless)

    shared_secret = _read_shared_secret(username, cred_dir)
    if shared_secret:
        if not password:
            raise SystemExit("[pics] STEAM_WATCHER_PASSWORD is required for non-interactive TOTP login.")
        _totp_login(client, username, password, shared_secret)
    elif sys.stdin.isatty():
        client.cli_login(username, password)  # interactive fallback (prompts for Guard code)
        print(f"[pics] logged in as {username}")
    else:
        raise SystemExit(
            "[pics] no TOTP shared secret and no interactive terminal. Run enroll_authenticator.py "
            "once to enable the mobile authenticator, then set STEAM_WATCHER_PASSWORD in pics.env."
        )


def main() -> None:
    username = os.environ["STEAM_WATCHER_USERNAME"]
    password = os.environ.get("STEAM_WATCHER_PASSWORD")  # cli_login prompts + persists if omitted/2FA
    client = SteamClient()
    steam_login(client, username, password)

    conn = psycopg.connect(DATABASE_URL, autocommit=True)

    # Baseline current builds (records any that differ from what's stored).
    apps = tracked_apps(conn)
    builds = product_builds(client, apps)
    write_changes(conn, detect_build_changes(stored_builds(conn, apps), builds))
    print(f"[pics] baseline complete: {len(builds)} apps with a public build id")

    # Watch loop: re-read all tracked apps' builds each cycle and record changes.
    # get_product_info batches 300/call (~4 calls for ~1000 apps), so this is light
    # and far more reliable than the PICS changelist stream (get_changes_since).
    # Use client.sleep (gevent-aware), NOT time.sleep: stdlib sleep blocks gevent's
    # hub, which stalls Steam heartbeats until the connection drops and the next
    # get_product_info raises gevent.timeout.Timeout.
    while True:
        client.sleep(POLL_SECONDS)
        try:
            if not client.logged_on:
                print("[pics] disconnected; re-authenticating…")
                steam_login(client, username, password)  # fresh TOTP login
            apps = tracked_apps(conn)
            builds = product_builds(client, apps)
            changes = detect_build_changes(stored_builds(conn, apps), builds)
            write_changes(conn, changes)
            if changes:
                print(f"[pics] recorded {len(changes)} build change(s): {[c['app_id'] for c in changes]}")
        except (Exception, Timeout) as exc:  # gevent.Timeout is BaseException, not Exception
            print(f"[pics] loop error: {exc}")
            client.sleep(30)


if __name__ == "__main__":
    main()
