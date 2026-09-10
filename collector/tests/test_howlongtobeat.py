from steam_collector.howlongtobeat import parse_hltb_results, best_match

# Trimmed from a real /api/bleed response. Times are in SECONDS.
SAMPLE = {
    "color": "blue",
    "category": "games",
    "count": 2,
    "data": [
        {"game_name": "Hades", "comp_main": 84226, "comp_plus": 174581, "comp_100": 342889},
        {"game_name": "Hades II", "comp_main": 110203, "comp_plus": 185656, "comp_100": 375910},
    ],
}


def test_parse_hltb_results_converts_seconds_to_hours():
    out = parse_hltb_results(SAMPLE)
    assert out[0] == {"name": "Hades", "main": 23, "extra": 48, "completionist": 95}
    assert out[1]["name"] == "Hades II"


def test_parse_hltb_results_zero_or_missing_becomes_none():
    payload = {"data": [{"game_name": "Demo", "comp_main": 0}]}  # plus/100 absent
    out = parse_hltb_results(payload)
    assert out == [{"name": "Demo", "main": None, "extra": None, "completionist": None}]


def test_parse_hltb_results_empty_when_no_data():
    assert parse_hltb_results({}) == []
    assert parse_hltb_results({"data": None}) == []


def test_best_match_prefers_exact_normalized_name():
    results = parse_hltb_results(SAMPLE)
    m = best_match(results, "hades")
    assert m["name"] == "Hades"  # not "Hades II"


def test_best_match_ignores_punctuation_and_case():
    results = [{"name": "Baldur's Gate 3", "main": 73, "extra": 116, "completionist": 181}]
    assert best_match(results, "baldurs gate 3")["name"] == "Baldur's Gate 3"


def test_best_match_falls_back_to_first():
    results = parse_hltb_results(SAMPLE)
    assert best_match(results, "Totally Unknown Game")["name"] == "Hades"


def test_best_match_none_on_empty():
    assert best_match([], "anything") is None
