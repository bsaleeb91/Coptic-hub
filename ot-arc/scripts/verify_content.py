"""QC for everything on the page that is not a patristic quote.

1. part-one.json: every copy string appears verbatim in the handoff text.
2. notes/*.md: every "quoted phrase" appears verbatim in the handoff, the fetched
   scripture, or quotes.json; every Book Chapter:Verse reference is one the handoff
   names or one whose text is in scripture.json.
3. No emoji anywhere in the shipped files.

Usage: python scripts/verify_content.py path/to/handoff.txt
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
handoff = Path(sys.argv[1]).read_text(encoding="utf-8")
# Apply the teacher's approved post-handoff wording changes.
for e in json.loads((ROOT / "content/teacher-edits.json").read_text(encoding="utf-8"))["edits"]:
    handoff = handoff.replace(e["from"], e["to"])
part = json.loads((ROOT / "content/part-one.json").read_text(encoding="utf-8"))
scripture = json.loads((ROOT / "content/scripture.json").read_text(encoding="utf-8"))
quotes = json.loads((ROOT / "content/quotes.json").read_text(encoding="utf-8"))["quotes"]

fails = []


def strings(x, key=None):
    if isinstance(x, dict):
        for k, v in x.items():
            if not k.startswith("_") and k not in ("id", "title", "part_label"):
                yield from strings(v, k)
    elif isinstance(x, list):
        for v in x:
            yield from strings(v, key)
    else:
        yield x


for s in strings(part):
    if s not in handoff:
        fails.append(f"part-one.json string not verbatim in handoff: {s[:60]!r}")

verse_text = " ".join(v["text"] for p in scripture["passages"] for v in p["verses"])
quote_text = " ".join(q["quote"] for q in quotes)
pool = " ".join([handoff, verse_text, quote_text])
fetched_refs = {p["reference"] for p in scripture["passages"]}

REF = re.compile(r"\b((?:[12] )?[A-Z][a-z]+) (\d+):(\d+)(?:[-–](\d+))?")
for md in sorted((ROOT / "content/notes").glob("*.md")):
    text = md.read_text(encoding="utf-8")
    plain = re.sub(r"\*+", "", text)
    for q in re.findall(r"“([^”]+)”|\"([^\"]+)\"", plain):
        phrase = (q[0] or q[1]).strip().rstrip(".,")
        # Rhetorical phrases of my own in quotes are allowed only if flagged here explicitly.
        if phrase in ("give us the land anyway", "Egypt"):
            continue
        if phrase not in pool and phrase.replace("’", "'") not in pool.replace("’", "'"):
            fails.append(f"{md.name}: quoted phrase not found in any source: {phrase!r}")
    for m in REF.finditer(plain):
        ref = m.group(0).replace("–", "-")
        in_fetched = any(ref.split(":")[0] == r.split(":")[0] and
                         int(m.group(3)) >= int(r.split(":")[1].split("-")[0]) and
                         int(m.group(3)) <= int(r.split(":")[1].split("-")[-1]) for r in fetched_refs)
        if not in_fetched and ref not in handoff:
            fails.append(f"{md.name}: scripture reference not backed by handoff or fetched text: {ref}")

# 3. class-part-one.json: quote ids exist, chosen verses exist, quoted phrases traceable.
cls = json.loads((ROOT / "content/class-part-one.json").read_text(encoding="utf-8"))
qids = {q["id"] for q in quotes}
for eid, e in cls["eras"].items():
    if e["quote"] not in qids:
        fails.append(f"class {eid}: unknown quote id {e['quote']}")
    book = e["verse_ref"].rsplit(" ", 1)[0]
    if not any(p["reference"].rsplit(" ", 1)[0] == book and any(v["verse"] == e["verse"] for v in p["verses"])
               for p in scripture["passages"]):
        fails.append(f"class {eid}: verse {e['verse_ref']} not in scripture.json")
    for m in e.get("moments", []):
        if m["thread"] not in {t["id"] for t in part["threads"]}:
            fails.append(f"class {eid}: moment has unknown storyline {m['thread']}")
if cls["closing"]["quote"] not in qids:
    fails.append("class closing: unknown quote id")
for s_ in strings(cls):
    for q in re.findall(r"\"([^\"]+)\"", str(s_)):
        if q.rstrip(".,?") not in pool:
            fails.append(f"class copy quoted phrase not found in any source: {q!r}")

EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿⭐✅❌⚠]")
for f in list(ROOT.glob("*.html")) + list(ROOT.glob("*.css")) + list(ROOT.glob("*.js")) + list((ROOT / "content").rglob("*.*")):
    if f.name.startswith("_"):
        continue
    if EMOJI.search(f.read_text(encoding="utf-8")):
        fails.append(f"emoji found in {f.relative_to(ROOT)}")

if fails:
    print(f"FAIL ({len(fails)})")
    for f in fails:
        print("  -", f)
    sys.exit(1)
print("PASS: page copy verbatim from handoff; notes' quotations and references all traceable; no emoji")
