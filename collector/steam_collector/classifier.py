"""Classify a news item into MAJOR | CONTENT | HOTFIX | UPDATE.

Precedence (highest first): HOTFIX, MAJOR, CONTENT, else UPDATE.
Heuristic, keyword-driven. Defaults conservatively to UPDATE when unsure.
"""
import re

_HOTFIX = re.compile(r"\b(hotfix|crash\s*fix|quick\s*fix|emergency)\b", re.I)
_MAJOR = re.compile(
    r"\b(major update|out of early access|full release|expansion|overhaul|"
    r"season\s*\d+|biggest update)\b|\bv?\d+\.0\b", re.I)
_CONTENT = re.compile(
    r"\b(dlc|new map|new hero|new character|new content|new system|new ship|"
    r"adds?\s+\d+|new\s+\w+\s+(map|mode|hero|character|content))\b", re.I)


def classify(title: str, body: str) -> str:
    text = f"{title or ''} {body or ''}"
    if _HOTFIX.search(text):
        return "HOTFIX"
    if _MAJOR.search(text):
        return "MAJOR"
    if _CONTENT.search(text):
        return "CONTENT"
    return "UPDATE"
