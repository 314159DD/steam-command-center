from steam_collector.pics import extract_builds, detect_build_changes


def test_extract_builds_reads_public_branch_buildid():
    product_info = {"apps": {
        570: {"appid": 570, "depots": {"branches": {"public": {"buildid": "12345678"}}}},
        730: {"appid": 730, "depots": {"branches": {"public": {"buildid": "99"}, "beta": {"buildid": "100"}}}},
        9: {"appid": 9, "depots": {"branches": {}}},  # no public branch -> skipped
    }}
    assert extract_builds(product_info) == {570: "12345678", 730: "99"}


def test_extract_builds_tolerates_missing_structure():
    assert extract_builds({}) == {}
    assert extract_builds({"apps": {1: {"appid": 1}}}) == {}


def test_detect_build_changes_flags_new_and_changed_only():
    old = {570: "100", 730: "200"}
    new = {570: "100", 730: "201", 440: "5"}  # 730 changed, 440 new, 570 same
    changes = detect_build_changes(old, new)
    assert {c["app_id"] for c in changes} == {730, 440}
    assert {"app_id": 730, "build_id": "201"} in changes
