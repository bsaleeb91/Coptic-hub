"""Split the Orations Against the Arians (NPNF, public domain) into
{discourse: {section: text}}. Usage: python -I scripts/split_orations.py"""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
t = (root / "sources/orations.txt").read_text(encoding="utf-8")
t = re.sub(r"\s+", " ", re.sub(r"\[\[page \d+\]\]", " ", t))
starts = [m.start() for m in re.finditer(r"Discourse [1-4] ", t)]
out = {}
for d, (a, b) in enumerate(zip(starts, starts[1:] + [len(t)]), 1):
    body = t[a:b]
    secs, expected = {}, 1
    # a section starts with "N. " followed by a capital letter or quote
    for m in re.finditer(r"(?<![\d:\-])(\d{1,2})\. (?=[A-Z\"'‘“(])", body):
        n = int(m.group(1))
        if n == expected:
            secs[n] = m.end(); expected += 1
    keys = sorted(secs)
    out[str(d)] = {str(k): body[secs[k]:(secs[keys[i+1]] if i+1 < len(keys) else len(body))].strip()
                   for i, k in enumerate(keys)}
    print("Discourse", d, "sections:", len(keys))
(root / "sources/orations-sections.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
