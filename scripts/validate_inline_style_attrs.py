#!/usr/bin/env python3
"""Fail closed when built LDW pages contain CSP-blocked HTML style attributes.

Our deployed Content-Security-Policy intentionally omits 'unsafe-inline' from
style-src. This guard checks actual built HTML rather than only Astro source,
so rendered markup and future components are covered without a dependency.
"""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


class InlineStyleAttributeFinder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.locations: list[tuple[int, str]] = []

    def _check(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if any(name.lower() == "style" for name, _ in attrs):
            self.locations.append((self.getpos()[0], tag))

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._check(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._check(tag, attrs)


def find_inline_style_attributes(html: str) -> list[tuple[int, str]]:
    parser = InlineStyleAttributeFinder()
    parser.feed(html)
    parser.close()
    return parser.locations


def validate_built_pages(directory: Path = DIST) -> list[str]:
    if not directory.is_dir():
        return [f"{directory}: missing built HTML directory; run npm run build first"]

    pages = sorted(directory.rglob("*.html"))
    if not pages:
        return [f"{directory}: no built HTML pages found; guard cannot pass vacuously"]

    errors: list[str] = []
    for page in pages:
        try:
            violations = find_inline_style_attributes(page.read_text(encoding="utf-8"))
        except (OSError, UnicodeError) as exc:
            errors.append(f"{page.relative_to(directory)}: cannot validate built HTML ({type(exc).__name__})")
            continue

        for line, tag in violations:
            errors.append(
                f"{page.relative_to(directory)}:{line}: prohibited inline style attribute on <{tag}>"
            )
    return errors


if __name__ == "__main__":
    problems = validate_built_pages()
    for problem in problems:
        print(f"[FAIL] {problem}", file=sys.stderr)
    if problems:
        sys.exit(1)
    print("[PASS] Built HTML has no CSP-blocked inline style attributes")
