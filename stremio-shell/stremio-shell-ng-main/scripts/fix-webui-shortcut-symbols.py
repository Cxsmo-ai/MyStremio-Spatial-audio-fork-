"""Normalize shortcut key symbols in bundled main.js to ASCII labels."""
from __future__ import annotations

import re
import sys
from pathlib import Path

# ASCII-only labels avoid encoding issues in WebView / cached bundles.
CANONICAL = (
    'Shift:"".concat(a("SETTINGS_SHORTCUT_SHIFT")),'
    'Space:a("SETTINGS_SHORTCUT_SPACE"),'
    'Ctrl:a("SETTINGS_SHORTCUT_CTRL"),'
    'Escape:a("SETTINGS_SHORTCUT_ESC"),'
    'Backspace:a("SETTINGS_SHORTCUT_BACKSPACE"),'
    'ArrowUp:"Up",'
    'ArrowDown:"Down",'
    'ArrowLeft:"Left",'
    'ArrowRight:"Right"}'
)

PATTERN = re.compile(
    r'Shift:"[^"]*"\.concat\(a\("SETTINGS_SHORTCUT_SHIFT"\)\),'
    r'Space:a\("SETTINGS_SHORTCUT_SPACE"\),'
    r'Ctrl:a\("SETTINGS_SHORTCUT_CTRL"\),'
    r'Escape:a\("SETTINGS_SHORTCUT_ESC"\),'
    r'Backspace:a\("SETTINGS_SHORTCUT_BACKSPACE"\),'
    r'ArrowUp:"[^"]*",'
    r'ArrowDown:"[^"]*",'
    r'ArrowLeft:"[^"]*",'
    r'ArrowRight:"[^"]*"\}',
    re.DOTALL,
)


def repair_main_js(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if CANONICAL in text:
        return False
    fixed, count = PATTERN.subn(lambda _m: CANONICAL, text, count=1)
    if count != 1:
        print(f"Shortcut symbol patch skipped: pattern not found in {path}", file=sys.stderr)
        return False
    path.write_bytes(fixed.encode("utf-8"))
    return True


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: fix-webui-shortcut-symbols.py <path-to-main.js>", file=sys.stderr)
        return 2

    target = Path(sys.argv[1])
    if not target.is_file():
        print(f"Missing file: {target}", file=sys.stderr)
        return 1

    changed = repair_main_js(target)
    if changed:
        print(f"Repaired shortcut key symbols in {target}")
    else:
        print(f"Shortcut key symbols already OK in {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
