#!/usr/bin/env python3
"""Patch bundled React hero: no Breaking Bad flash before catalog titles load."""

from __future__ import annotations

import re
import sys
from pathlib import Path


PATCHES: list[tuple[str, str]] = [
    (
        "function T(){var e=(0,_.loadCachedTitles)();return(null==e?void 0:e.length)?e:[i({},r.FALLBACK_TITLES[0])]}",
        "function T(){var e=(0,_.loadCachedTitles)();return(null==e?void 0:e.length)?e:[]}",
    ),
    (
        "var U=null!==(a=null!==(t=I[O])&&void 0!==t?t:I[0])&&void 0!==a?a:r.FALLBACK_TITLES[0]",
        "var U=null!==(a=null!==(t=I[O])&&void 0!==t?t:I[0])&&void 0!==a?a:null",
    ),
    (
        "case 0:return t=(0,_.loadCachedTitles)(),a=null!==(o=null==t?void 0:t.length)&&void 0!==o?o:0,e.next=2,Promise.resolve(a>0?t:[i({},r.FALLBACK_TITLES[0])]);",
        "case 0:return t=(0,_.loadCachedTitles)(),a=null!==(o=null==t?void 0:t.length)&&void 0!==o?o:0,e.next=2,Promise.resolve(a>0?t:[]);",
    ),
]

REGEX_PATCHES: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"\[i\(\{\},[^.]+\.FALLBACK_TITLES\[0\]\)\]"),
        "[]",
    ),
    (
        re.compile(
            r"Promise\.resolve\(a>0\?t:\[i\(\{\},[^.]+\.FALLBACK_TITLES\[0\]\)\]\)"
        ),
        "Promise.resolve(a>0?t:[])",
    ),
    (
        re.compile(r"(\?[^:]+:)r\.FALLBACK_TITLES\[0\](?=[,\]\)])"),
        r"\1null",
    ),
]


def patch_main_js(path: Path) -> None:
    text = path.read_text(encoding="utf-8", errors="replace")
    original = text

    for old, new in PATCHES:
        if old in text:
            text = text.replace(old, new)

    for pattern, replacement in REGEX_PATCHES:
        text = pattern.sub(replacement, text)

    if text == original:
        if "FALLBACK_TITLES[0]" not in text:
            print(f"Hero fallback patch already applied in {path}")
            return
        print(
            f"Warning: hero fallback patterns not found in {path}; "
            "bundle may use a different hero module layout"
        )
        return

    path.write_text(text, encoding="utf-8")
    print(f"Patched hero fallback loading behavior in {path}")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"Usage: {sys.argv[0]} <path-to-main.js>")
    patch_main_js(Path(sys.argv[1]))


if __name__ == "__main__":
    main()
