#!/usr/bin/env python3
"""Synthetic tests for the built HTML inline-style CSP guard."""
from __future__ import annotations

from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_inline_style_attrs import find_inline_style_attributes, validate_built_pages


class InlineStyleGuardTests(unittest.TestCase):
    def test_allows_stylesheets_style_elements_comments_and_regular_attributes(self) -> None:
        markup = """<!doctype html>
<html><head><style>.hero { color: teal }</style></head>
<body><div class="hero" data-style="color: red">OK</div>
<!-- <span style="ignored"> -->
<script>const x = '<div style="not markup">';</script>
</body></html>"""
        self.assertEqual(find_inline_style_attributes(markup), [])

    def test_rejects_quoted_unquoted_and_case_insensitive_style_attributes(self) -> None:
        markup = '<p style="color:red">A</p>\n<svg STYLE=display:none />\n<span style=color:red>B</span>'
        self.assertEqual(find_inline_style_attributes(markup), [(1, "p"), (2, "svg"), (3, "span")])

    def test_missing_or_empty_build_fails_closed(self) -> None:
        with TemporaryDirectory() as temporary:
            base = Path(temporary)
            self.assertIn("missing built HTML directory", validate_built_pages(base / "dist")[0])
            (base / "dist").mkdir()
            self.assertIn("no built HTML pages found", validate_built_pages(base / "dist")[0])

    def test_validates_all_built_pages_and_reports_violation_without_values(self) -> None:
        with TemporaryDirectory() as temporary:
            base = Path(temporary)
            (base / "pages").mkdir()
            (base / "index.html").write_text('<html><body><p>OK</p></body></html>', encoding="utf-8")
            (base / "pages" / "bad.html").write_text('<div style="background:url(secret)">Bad</div>', encoding="utf-8")
            errors = validate_built_pages(base)
            self.assertEqual(len(errors), 1)
            self.assertIn("pages/bad.html:1", errors[0].replace("\\", "/"))
            self.assertIn("prohibited inline style attribute", errors[0])
            self.assertNotIn("secret", errors[0])

    def test_clean_pages_pass(self) -> None:
        with TemporaryDirectory() as temporary:
            base = Path(temporary)
            (base / "index.html").write_text('<div class="ok">Welcome</div>', encoding="utf-8")
            self.assertEqual(validate_built_pages(base), [])


if __name__ == "__main__":
    unittest.main()
