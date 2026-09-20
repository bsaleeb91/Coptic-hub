"""Independent QC for content/quotes.json against commentary.db.

For every quote record this checks, without reusing the builder's code paths:
  1. the cited chunk exists and matches the `source` string (collection, file, page);
  2. every excerpt of the quote (split on the joining ellipsis) occurs verbatim in that
     chunk, after only whitespace/ligature/quote-mark normalization and the fixes the
     record itself declares in `extraction_fixes`;
  3. the attributed author is actually named in the chunk or in the file name, so an
     attribution is never inferred;
  4. required fields are present and `attaches_to` is a known id;
  5. Macarius records carry the attribution flag.
Exit code 1 on any failure.

Usage: python scripts/verify_quotes.py [path/to/commentary.db]
"""
import ast
import json
import re
import sqlite3
import sys
from pathlib import Path

DB = sys.argv[1] if len(sys.argv) > 1 else str(Path.home() / "projects" / "commentary.db")
QUOTES = Path(__file__).resolve().parent.parent / "content" / "quotes.json"
IDS = {"era-1", "era-2", "era-3", "era-4", "thread-mercy", "thread-sacrifice", "thread-dwelling", "closing"}
REQUIRED = ("id", "father", "work", "scripture", "quote", "attaches_to", "source")
ELLIPSIS = "…"

# The surname/keyword that must appear in the chunk (or file name) for each attribution.
AUTHOR_KEYS = {
    "Fr. Tadros Y. Malaty": ["Malaty"],
    "St. Ambrose of Milan": ["Ambrose"],
    "St. Athanasius the Apostolic": ["Athanasius"],
    "St. Ephrem the Syrian": ["EPHREM"],
    "Clement of Alexandria": ["CLEMENT OF ALEXANDRIA", "Clement of Alexandria", "Clement- The Instructor"],
    "St. Cyril of Alexandria": ["CYRIL OF ALEXANDRIA", "Cyril of Alexandria", "St. Cyril", "Cyril"],
    "St. Antony the Great": ["Antony"],
    "St. Macarius the Great (the Egyptian)": ["Macarius"],
}


def norm(text):
    text = text.replace("ﬁ", "fi").replace("ﬂ", "fl")
    text = text.replace("―", "“").replace("‖", "”")
    return re.sub(r"\s+", " ", text).strip()


def main():
    con = sqlite3.connect(DB)
    doc = json.loads(QUOTES.read_text(encoding="utf-8"))
    fails, notes, seen = [], [], set()
    for q in doc["quotes"]:
        qid = q.get("id", "?")
        missing = [f for f in REQUIRED if not q.get(f)]
        if missing:
            fails.append(f"{qid}: missing fields {missing}")
            continue
        if qid in seen:
            fails.append(f"{qid}: duplicate id")
        seen.add(qid)
        if q["attaches_to"] not in IDS:
            fails.append(f"{qid}: unknown attaches_to {q['attaches_to']!r}")

        m = re.search(r"chunks\.id=(\d+)", q["source"])
        if not m:
            fails.append(f"{qid}: no chunk id in source")
            continue
        row = con.execute("select source, filename, page_number, chunk_text from chunks where id=?",
                          (int(m.group(1)),)).fetchone()
        if not row:
            fails.append(f"{qid}: chunk {m.group(1)} not in database")
            continue
        coll, fname, page, raw = row
        if coll not in q["source"] or fname not in q["source"] or f"PDF p. {page}" not in q["source"]:
            fails.append(f"{qid}: source string does not match chunk metadata")

        text = norm(raw)
        for fx in q.get("extraction_fixes", []):
            a, b = (ast.literal_eval(s.strip()) for s in fx.split(" -> "))
            if a not in text:
                fails.append(f"{qid}: declared fix target {a!r} not in chunk")
            text = text.replace(a, b)

        body = q["quote"].strip()
        body = body[1:] if body.startswith(ELLIPSIS) else body
        body = body[:-1].rstrip() if body.endswith(ELLIPSIS) else body
        for piece in (p.strip() for p in body.split(f" {ELLIPSIS} ")):
            if piece and piece not in text:
                fails.append(f"{qid}: excerpt not found verbatim: {piece[:70]!r}")

        keys = AUTHOR_KEYS.get(q["father"])
        if not keys:
            fails.append(f"{qid}: no author check defined for {q['father']!r}")
        elif not any(k in raw or k in fname or k in coll for k in keys):
            # An entry can begin in the preceding chunk of the same file (e.g. ACCS headings).
            prev = con.execute("select filename, chunk_text from chunks where id=?",
                               (int(m.group(1)) - 1,)).fetchone()
            if prev and prev[0] == fname and any(k in prev[1] for k in keys):
                notes.append(f"{qid}: author named in preceding chunk {int(m.group(1)) - 1}")
            else:
                fails.append(f"{qid}: author {q['father']!r} not named in chunk, file or collection")

        if q.get("voice") == "commentator":
            # Malaty's own words must not sit inside a [bracketed] quotation of a father.
            first = body.split(f" {ELLIPSIS} ")[0].strip()
            pos = text.find(first)
            if pos >= 0 and text[:pos].count("[") > text[:pos].count("]"):
                fails.append(f"{qid}: 'commentator' excerpt sits inside a [bracketed] father quotation")

        if "Macarius" in q["father"] + q["work"] and "MACARIUS FLAG" not in q.get("note", ""):
            fails.append(f"{qid}: Macarius attribution not flagged")

    slots = IDS - {"closing"}
    uncovered = slots - {q["attaches_to"] for q in doc["quotes"]}
    if sorted(uncovered) != sorted(doc.get("unmatched", [])):
        fails.append(f"unmatched list {doc.get('unmatched')} disagrees with actual gaps {sorted(uncovered)}")

    n = len(doc["quotes"])
    if fails:
        print(f"FAIL ({len(fails)} problems across {n} quotes)")
        for f in fails:
            print("  -", f)
        sys.exit(1)
    for x in notes:
        print("  note:", x)
    print(f"PASS: {n} quotes verified verbatim against commentary.db; attributions named in source; "
          f"Macarius flagged; unmatched={doc.get('unmatched')}")


if __name__ == "__main__":
    main()
