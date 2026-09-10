from steam_collector.classifier import classify

def test_hotfix_wins_on_crash_keywords():
    assert classify("Hotfix 1.4.1", "Fixes startup crash on AMD GPUs") == "HOTFIX"
    assert classify("Quick fix", "emergency patch for login") == "HOTFIX"

def test_major_on_version_and_phrases():
    assert classify("Patch 1.0 - Full Release", "Out of Early Access") == "MAJOR"
    assert classify("The Frostbite Update", "Our biggest major update yet, full overhaul") == "MAJOR"

def test_content_on_added_nouns():
    assert classify("Outer Rim DLC", "Adds 3 new systems and 12 ships") == "CONTENT"
    assert classify("New Map", "A brand new map joins the rotation") == "CONTENT"

def test_default_is_update():
    assert classify("Balance Pass", "Weapon tuning and 11 bug fixes") == "UPDATE"

def test_hotfix_beats_content_when_both_present():
    # crash-fix language dominates even if 'new' appears
    assert classify("Hotfix", "Fixes a crash; also new icon") == "HOTFIX"
