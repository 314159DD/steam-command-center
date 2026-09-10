#!/usr/bin/env python3
"""One-time: enable the Steam Mobile Authenticator on the watcher account and save its
shared_secret, so pics_worker.py can log in non-interactively (TOTP) from a service.

WHY: Steam retired the legacy login-key + sentry persistence that ValvePython/steam 1.4.4
uses, so an unattended login can't be cached. The mobile authenticator's shared secret lets
the worker generate a fresh Steam Guard code on every login instead.

Run interactively on the VPS:
    cd /path/to/steam-command-center/collector && source .venv/bin/activate
    set -a && source pics.env && set +a
    python enroll_authenticator.py

Requires:
  * STEAM_WATCHER_USERNAME (from pics.env) and the account password (prompted).
  * A VERIFIED PHONE NUMBER already on the account. If missing, add one at
    https://store.steampowered.com/phone/add and re-run.
  * You will receive an SMS code to finalize enrollment.

⚠ SAVE THE REVOCATION CODE printed at the end (looks like R#####). It is the ONLY way to
  remove the authenticator if the secret is ever lost - losing it can lock you out.
"""
import json
import os
import sys

from steam.client import SteamClient
from steam.guard import SteamAuthenticator, SteamAuthenticatorError


def _save(path: str, secrets: dict) -> None:
    with open(path, "w") as fh:
        json.dump(secrets, fh, indent=2)
    os.chmod(path, 0o600)


def main() -> None:
    username = os.environ["STEAM_WATCHER_USERNAME"]
    password = os.environ.get("STEAM_WATCHER_PASSWORD")  # else cli_login prompts for it
    cred_dir = os.environ.get("PICS_CRED_DIR", os.path.expanduser("~/.steam-watcher"))
    os.makedirs(cred_dir, exist_ok=True)
    auth_file = os.path.join(cred_dir, f"{username}_authenticator.json")

    if os.path.exists(auth_file):
        print(f"⚠ {auth_file} already exists - an authenticator may already be enrolled.")
        if input("Continue and overwrite? [y/N]: ").strip().lower() != "y":
            return

    client = SteamClient()
    print(f"[enroll] logging in as {username} (enter password + the Steam Guard email code)…")
    client.cli_login(username, password)
    print("[enroll] logged in.")

    sa = SteamAuthenticator(backend=client)
    if not sa.has_phone_number():
        print("[enroll] This account has NO verified phone number, which is required.")
        print("[enroll] Add one at https://store.steampowered.com/phone/add and re-run this script.")
        sys.exit(1)

    try:
        sa.add()  # sends an SMS code to the account's phone; populates sa.secrets
    except SteamAuthenticatorError as exc:
        print(f"[enroll] add() failed: {exc}")
        sys.exit(1)

    # Persist secrets immediately - the revocation code is needed even if finalize fails.
    _save(auth_file, sa.secrets)
    rev = sa.secrets.get("revocation_code")
    print(f"[enroll] secrets saved to {auth_file}")
    print(f"[enroll] *** REVOCATION CODE: {rev} *** - WRITE THIS DOWN NOW.")

    sms = input("[enroll] Enter the SMS code Steam just texted to the account's phone: ").strip()
    sa.finalize(sms)
    _save(auth_file, sa.secrets)  # re-save (status is now activated)

    print("[enroll] ✅ Mobile authenticator enabled.")
    print(f"[enroll] shared_secret stored in {auth_file}; pics_worker.py reads it automatically.")
    print(f"[enroll] REVOCATION CODE (save it!): {rev}")
    print("[enroll] Now set STEAM_WATCHER_PASSWORD in pics.env, then start the service.")


if __name__ == "__main__":
    main()
