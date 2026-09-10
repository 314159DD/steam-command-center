import httpx, respx
from steam_collector.opencritic_cal import parse_ics, fetch_calendar


SAMPLE = (
    "BEGIN:VCALENDAR\r\n"
    "BEGIN:VEVENT\r\nUID:1\r\nDTSTART;VALUE=DATE:20260701\r\n"
    "SUMMARY:Cool Game Release\r\nURL;VALUE=URI:https://opencritic.com/game/1/cool\r\nEND:VEVENT\r\n"
    "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20200101\r\nSUMMARY:Old Game Release\r\nEND:VEVENT\r\n"
    "END:VCALENDAR\r\n"
)


def test_parse_ics_keeps_only_upcoming_strips_release_suffix():
    out = parse_ics(SAMPLE, "20260615")
    assert out == [{"name": "Cool Game", "date": "2026-07-01", "url": "https://opencritic.com/game/1/cool"}]


def test_parse_ics_unfolds_wrapped_lines():
    folded = (
        "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260801\r\n"
        "SUMMARY:Very Long Game Title That Was\r\n  Folded Release\r\n"
        "URL;VALUE=URI:https://opencritic.com/game/9/very-long\r\n -title\r\nEND:VEVENT\r\n"
    )
    out = parse_ics(folded, "20260615")
    assert out[0]["name"] == "Very Long Game Title That Was Folded"
    assert out[0]["url"] == "https://opencritic.com/game/9/very-long-title"


@respx.mock
def test_fetch_calendar_parses_live_feed():
    respx.get("https://img.opencritic.com/calendar/OpenCritic.ics").mock(return_value=httpx.Response(200, text=SAMPLE))
    with httpx.Client() as c:
        out = fetch_calendar(c, today="20260615")
    assert out[0]["name"] == "Cool Game"
