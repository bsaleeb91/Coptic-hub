"""Fetch the passage texts shown on the site into content/scripture.json.

Text comes verbatim from bible-api.com, World English Bible, British Edition (public
domain; renders the divine name as "the LORD"). Nothing is typed by hand. Only
whitespace is collapsed. Run with --check to re-fetch and compare against the saved
file without writing (used by QC).

The passages are the ones the handoff pairs with each era's key verse, plus John 1:14
for the closing.
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

TRANSLATION = "webbe"
OUT = Path(__file__).resolve().parent.parent / "content" / "scripture.json"

PASSAGES = [
    ("era-1", "Genesis 3:8-10"),
    ("era-1", "Genesis 3:21"),
    ("era-2", "Exodus 25:8"),
    ("era-2", "Exodus 33:14-15"),
    ("era-3", "1 Samuel 8:7"),
    ("era-3", "1 Samuel 16:7"),
    ("era-3", "1 Kings 8:27"),
    ("era-4", "Ezekiel 10:18-19"),
    ("era-4", "2 Chronicles 36:15-16"),
    ("closing", "John 1:14"),
]


def fetch(ref):
    url = f"https://bible-api.com/{urllib.parse.quote(ref)}?translation={TRANSLATION}"
    with urllib.request.urlopen(url, timeout=30) as r:
        data = json.load(r)
    verses = [{"verse": f"{v['chapter']}:{v['verse']}", "text": re.sub(r"\s+", " ", v["text"]).strip()}
              for v in data["verses"]]
    return {"reference": data["reference"], "verses": verses, "url": url}


def main():
    check = "--check" in sys.argv
    records = []
    for attaches_to, ref in PASSAGES:
        rec = fetch(ref)
        rec["attaches_to"] = attaches_to
        records.append(rec)
    doc = {
        "translation": "World English Bible, British Edition (public domain), via bible-api.com",
        "passages": records,
    }
    if check:
        saved = json.loads(OUT.read_text(encoding="utf-8"))
        bad = [p["reference"] for p, s in zip(records, saved["passages"]) if p["verses"] != s["verses"]]
        if bad or len(records) != len(saved["passages"]):
            print("FAIL: scripture text differs from source for", bad)
            sys.exit(1)
        print(f"PASS: {len(records)} passages match bible-api.com ({TRANSLATION}) verbatim")
        return
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(records)} passages -> {OUT}")


if __name__ == "__main__":
    main()
