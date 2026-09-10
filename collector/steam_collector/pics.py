"""Pure helpers for the PICS build watcher (no Steam connection here, so it's testable).

The Steam client (ValvePython/steam) PICS `get_product_info(apps=[...])` returns app
metadata including per-branch build ids under depots.branches.<branch>.buildid.
We track the `public` branch build id and emit changes when it moves.
"""


def extract_builds(product_info: dict) -> dict:
    """{app_id: public_build_id} from a PICS get_product_info response."""
    out: dict[int, str] = {}
    for app_id, app in (product_info.get("apps") or {}).items():
        try:
            bid = app["depots"]["branches"]["public"]["buildid"]
        except (KeyError, TypeError):
            continue
        if bid:
            out[int(app_id)] = str(bid)
    return out


def detect_build_changes(old_builds: dict, new_builds: dict) -> list[dict]:
    """Emit {app_id, build_id} for apps whose public build id is new or changed."""
    return [
        {"app_id": app_id, "build_id": bid}
        for app_id, bid in new_builds.items()
        if old_builds.get(app_id) != bid
    ]
