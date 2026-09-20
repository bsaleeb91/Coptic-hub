"""Build content/scripture.json from scripts/nkjv-source.txt.

nkjv-source.txt is the verbatim text pulled from biblegateway.com (NKJV) via
Claude in Chrome. This script only strips footnote markers ([a], [b]) and splits
each passage into its numbered verses -- it does not alter any words. Verify with
scripts/verify_scripture.py, which re-checks every word against the same source file.

Usage: python scripts/build_scripture.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = (ROOT / "scripts/nkjv-source.txt").read_text(encoding="utf-8")
OUT = ROOT / "content/scripture.json"

# (attaches_to, reference, [(verse_label, exact substring in nkjv-source.txt), ...])
PASSAGES = [
    ("era-1", "Genesis 3:8-10", [
        ("3:8", "And they heard the [a]sound of the Lord God walking in the garden in the [b]cool of the day, and Adam and his wife hid themselves from the presence of the Lord God among the trees of the garden."),
        ("3:9", 'Then the Lord God called to Adam and said to him, "Where are you?"'),
        ("3:10", 'So he said, "I heard Your voice in the garden, and I was afraid because I was naked; and I hid myself."'),
    ]),
    ("era-1", "Genesis 3:21", [
        ("3:21", "Also for Adam and his wife the Lord God made tunics of skin, and clothed them."),
    ]),
    ("era-2", "Exodus 25:8", [
        ("25:8", "And let them make Me a sanctuary,[a] that I may dwell among them."),
    ]),
    ("era-2", "Exodus 33:14-15", [
        ("33:14", 'And He said, "My Presence will go with you, and I will give you rest."'),
        ("33:15", 'Then he said to Him, "If Your Presence does not go with us, do not bring us up from here.'),
    ]),
    ("era-3", "1 Samuel 8:7", [
        ("8:7", 'And the Lord said to Samuel, "Heed the voice of the people in all that they say to you; for they have not rejected you, but they have rejected Me, that I should not reign over them.'),
    ]),
    ("era-3", "1 Samuel 16:7", [
        ("16:7", 'But the Lord said to Samuel, "Do not look at his appearance or at his physical stature, because I have [a]refused him. For[b] the Lord does not see as man sees; for man looks at the outward appearance, but the Lord looks at the heart."'),
    ]),
    ("era-3", "1 Kings 8:27", [
        ("8:27", '"But will God indeed dwell on the earth? Behold, heaven and the heaven of heavens cannot contain You. How much less this temple which I have built!'),
    ]),
    ("era-4", "Ezekiel 10:18-19", [
        ("10:18", "Then the glory of the Lord departed from the threshold of the [a]temple and stood over the cherubim."),
        ("10:19", "And the cherubim lifted their wings and mounted up from the earth in my sight. When they went out, the wheels were beside them; and they stood at the door of the east gate of the Lord's house, and the glory of the God of Israel was above them."),
    ]),
    ("era-4", "2 Chronicles 36:15-16", [
        ("36:15", "And the Lord God of their fathers sent warnings to them by His messengers, rising up early and sending them, because He had compassion on His people and on His dwelling place."),
        ("36:16", "But they mocked the messengers of God, despised His words, and scoffed at His prophets, until the wrath of the Lord arose against His people, till there was no remedy."),
    ]),
    ("closing", "John 1:14", [
        ("1:14", "And the Word became flesh and dwelt among us, and we beheld His glory, the glory as of the only begotten of the Father, full of grace and truth."),
    ]),
]

FOOTNOTE = re.compile(r"\[[a-z]\]")


def main():
    passages = []
    for attaches_to, reference, verses in PASSAGES:
        out_verses = []
        for label, raw in verses:
            if raw not in SRC:
                raise SystemExit(f"NOT FOUND in nkjv-source.txt ({reference} {label}): {raw!r}")
            out_verses.append({"verse": label, "text": FOOTNOTE.sub("", raw).strip()})
        passages.append({"reference": reference, "verses": out_verses, "attaches_to": attaches_to})
    doc = {
        "translation": "New King James Version (NKJV)",
        "copyright": "Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. Used by permission. All rights reserved.",
        "source": "scripts/nkjv-source.txt (fetched from biblegateway.com via Claude in Chrome, 2026-09-18)",
        "passages": passages,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {sum(len(p['verses']) for p in passages)} verses across {len(passages)} passages -> {OUT}")


if __name__ == "__main__":
    main()
