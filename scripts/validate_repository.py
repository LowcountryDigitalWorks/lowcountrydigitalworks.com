#!/usr/bin/env python3
"""Dependency-free validation for the Lowcountry Digital Works website repository."""

from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ERRORS: list[str] = []

REQUIRED_FILES = (
    "README.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "LICENSE.md",
    "wrangler.jsonc",
    "public/index.html",
    "public/404.html",
    "public/_headers",
    "public/robots.txt",
    "public/sitemap.xml",
    "public/favicon.svg",
    "public/styles.css",
)

SECRET_PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "GitHub token": re.compile(r"\b(?:gh[pour]_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9.\-_]{36,}|github_pat_[A-Za-z0-9_]{20,})\b"),
    "OpenAI-style secret": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
    "Cloudflare API token assignment": re.compile(r"(?i)\bCLOUDFLARE_API_TOKEN\s*=\s*\S+"),
}


class DocumentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.hrefs: list[str] = []
        self.lang: str | None = None
        self.title_depth = 0
        self.title_text: list[str] = []
        self.has_viewport = False
        self.has_description = False
        self.has_main = False
        self.h1_count = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        if tag == "html":
            self.lang = data.get("lang")
        elif tag == "meta":
            if data.get("name", "").lower() == "viewport":
                self.has_viewport = True
            if data.get("name", "").lower() == "description" and data.get("content"):
                self.has_description = True
        elif tag == "main":
            self.has_main = True
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "title":
            self.title_depth += 1
        if data.get("id"):
            self.ids.append(data["id"] or "")
        if tag == "a" and data.get("href"):
            self.hrefs.append(data["href"] or "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self.title_depth:
            self.title_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.title_depth:
            self.title_text.append(data)


def error(message: str) -> None:
    ERRORS.append(message)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        error(f"{path.relative_to(ROOT)} is not valid UTF-8")
        return ""


def validate_required_files() -> None:
    for relative in REQUIRED_FILES:
        if not (ROOT / relative).is_file():
            error(f"Missing required file: {relative}")


def resolve_public_target(source: Path, href: str) -> tuple[Path | None, str | None]:
    parsed = urlparse(href)
    if parsed.scheme or parsed.netloc or href.startswith(("mailto:", "tel:")):
        return None, None
    anchor = parsed.fragment or None
    raw_path = parsed.path
    if not raw_path:
        return source, anchor
    if raw_path.startswith("/"):
        target = PUBLIC / raw_path.lstrip("/")
    else:
        target = source.parent / raw_path
    if raw_path.endswith("/"):
        target = target / "index.html"
    elif target.suffix == "":
        html_target = target.with_suffix(".html")
        index_target = target / "index.html"
        if html_target.exists():
            target = html_target
        elif index_target.exists():
            target = index_target
    return target.resolve(), anchor


def validate_html() -> None:
    parsed_docs: dict[Path, DocumentParser] = {}
    for path in sorted(PUBLIC.rglob("*.html")):
        parser = DocumentParser()
        parser.feed(read_text(path))
        parsed_docs[path.resolve()] = parser

        relative = path.relative_to(ROOT)
        if parser.lang != "en":
            error(f"{relative}: expected <html lang=\"en\">")
        if not "".join(parser.title_text).strip():
            error(f"{relative}: missing non-empty <title>")
        if not parser.has_viewport:
            error(f"{relative}: missing viewport meta tag")
        if path.name != "404.html" and not parser.has_description:
            error(f"{relative}: missing meta description")
        if not parser.has_main:
            error(f"{relative}: missing <main> landmark")
        if parser.h1_count != 1:
            error(f"{relative}: expected exactly one <h1>, found {parser.h1_count}")
        duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
        if duplicates:
            error(f"{relative}: duplicate ids: {', '.join(duplicates)}")

    for source, parser in parsed_docs.items():
        for href in parser.hrefs:
            target, anchor = resolve_public_target(source, href)
            if target is None:
                continue
            if not target.is_relative_to(PUBLIC.resolve()):
                error(f"{source.relative_to(ROOT)}: internal link escapes public directory: {href}")
                continue
            if not target.exists():
                error(f"{source.relative_to(ROOT)}: broken internal link: {href}")
                continue
            if anchor and target.suffix == ".html":
                target_parser = parsed_docs.get(target.resolve())
                if target_parser is None:
                    target_parser = DocumentParser()
                    target_parser.feed(read_text(target))
                    parsed_docs[target.resolve()] = target_parser
                if anchor not in target_parser.ids:
                    error(f"{source.relative_to(ROOT)}: missing anchor #{anchor} in {target.relative_to(ROOT)}")


def validate_discovery_files() -> None:
    robots = read_text(PUBLIC / "robots.txt")
    sitemap = read_text(PUBLIC / "sitemap.xml")
    index = read_text(PUBLIC / "index.html")

    if "Sitemap: https://lowcountrydigitalworks.com/sitemap.xml" not in robots:
        error("public/robots.txt: missing production sitemap declaration")
    if "<loc>https://lowcountrydigitalworks.com/</loc>" not in sitemap:
        error("public/sitemap.xml: missing production homepage URL")
    if '<link rel="canonical" href="https://lowcountrydigitalworks.com/">' not in index:
        error("public/index.html: missing production canonical URL")


def strip_jsonc_comments(text: str) -> str:
    return re.sub(r"(?m)^\s*//.*$", "", text)


def validate_wrangler() -> None:
    path = ROOT / "wrangler.jsonc"
    text = strip_jsonc_comments(read_text(path))
    try:
        import json

        data = json.loads(text)
    except Exception as exc:  # pragma: no cover - reports the parser failure
        error(f"wrangler.jsonc: invalid JSONC subset: {exc}")
        return

    if data.get("name") != "lowcountrydigitalworks":
        error("wrangler.jsonc: unexpected Worker name")
    assets = data.get("assets") or {}
    if assets.get("directory") != "./public":
        error("wrangler.jsonc: assets.directory must remain ./public for the current bootstrap")
    if assets.get("not_found_handling") != "404-page":
        error("wrangler.jsonc: expected not_found_handling=404-page")


def validate_headers() -> None:
    text = read_text(PUBLIC / "_headers")
    required_headers = (
        "Content-Security-Policy:",
        "Permissions-Policy:",
        "Referrer-Policy:",
        "X-Content-Type-Options:",
        "X-Frame-Options:",
        "Cross-Origin-Opener-Policy:",
        "X-Robots-Tag: noindex, nofollow",
    )
    for header in required_headers:
        if header not in text:
            error(f"public/_headers: missing {header}")
    if "unsafe-inline" in text or "unsafe-eval" in text:
        error("public/_headers: CSP must not allow unsafe-inline or unsafe-eval in the current static site")


def validate_favicon() -> None:
    icon = PUBLIC / "favicon.svg"
    if not icon.is_file() or icon.stat().st_size == 0:
        error("public/favicon.svg: missing or empty")
    if 'href="/favicon.svg"' not in read_text(PUBLIC / "index.html"):
        error("public/index.html: favicon is not referenced")


def validate_secret_patterns() -> None:
    excluded_parts = {".git", ".wrangler", "node_modules", "dist"}
    text_suffixes = {".html", ".css", ".js", ".mjs", ".cjs", ".json", ".jsonc", ".md", ".txt", ".xml", ".yml", ".yaml", ".py", ".toml", ".ini", ".cfg"}
    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in excluded_parts for part in path.parts):
            continue
        if path.suffix.lower() not in text_suffixes and path.name not in {"_headers", ".gitignore", ".editorconfig"}:
            continue
        text = read_text(path)
        for label, pattern in SECRET_PATTERNS.items():
            if pattern.search(text):
                error(f"{path.relative_to(ROOT)}: possible {label} detected")


def main() -> int:
    validate_required_files()
    validate_html()
    validate_discovery_files()
    validate_wrangler()
    validate_headers()
    validate_favicon()
    validate_secret_patterns()

    if ERRORS:
        print("Validation failed:")
        for item in ERRORS:
            print(f"- {item}")
        return 1

    print("Validation passed: repository structure, HTML, links, Cloudflare configuration, headers, discovery files, and secret patterns.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
