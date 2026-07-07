#!/usr/bin/env python3
import re
import sys
from pathlib import Path

def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "")
    text = path.read_text(encoding="utf-8", errors="replace")
    print("len", len(text))
    print("if(!r)return count", text.count("if(!r)return"))
    print("mystremio-hero-slot count", text.count("mystremio-hero-slot"))
    print("FALLBACK_TITLES[0] count", text.count("FALLBACK_TITLES[0]"))
    print("old crash f=(P=[(p=r).year]", "f=(P=[(p=r).year]" in text)
    print("service-worker ref", "service-worker" in text)

    idx = text.find("mystremio_hero_titles_v1")
    print("hero cache key at", idx)
    if idx >= 0:
        window = text[max(0, idx - 80000) : idx + 120000]
        for m in re.finditer(r"\[r\.year\]|\(p=r\)\.year|\.year\]", window):
            start = max(0, m.start() - 80)
            end = min(len(window), m.end() + 80)
            print("YEAR:", window[start:end])

    for pat in ["serviceWorker.register", "navigator.serviceWorker.register"]:
        print(pat, text.find(pat))

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
