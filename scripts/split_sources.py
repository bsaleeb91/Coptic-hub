"""Split the exported C.S.M.V. text (sources/csmv-web.txt) into sections 1-57.

Section numbers appear in the text as "(2)", "(3)"... except where a chapter
heading replaced them, and section 32 whose marker is missing (its start was
confirmed against the SVS printing, which marks sections with a section sign).
Usage, from the project root:  python -I scripts/split_sources.py
"""
import json, re, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
raw = (root / "sources/csmv-web.txt").read_text(encoding="utf-8")

# Footnote blocks at the end of each chapter.
raw = re.sub(r"Chapter \d+ Notes .*?Go back to the top of Chapter \d+", " ", raw, flags=re.S | re.I)

# Chapter headings: (chapter, heading start, first section, missing drop-cap letter)
chapters = [
    (1, "1. Creation and the Fall n", 1, "I"),
    (2, "2. The Divine Dilemma and Its Solution in the Incarnation e", 6, "W"),
    (3, "3. The Divine Dilemma and Its Solution in the Incarnation—continued h", 11, "W"),
    (4, "4. The Death of Christ l", 19, "A"),
    (5, "5. The Resurrection i", 26, "F"),
    (6, "6. Refutation of the Jews e", 33, "W"),
    (7, "7. Refutation of the Gentiles e", 41, "W"),
    (8, "8. Refutation of the Gentiles--continued h", 46, "W"),
    (9, "9. Conclusion e", 56, "H"),
]
for ch, head, sec, letter in chapters:
    assert raw.count(head) == 1, head
    raw = raw.replace(head, f" (({sec})) {letter}" + head[-1])
raw = raw.replace("It is, indeed, in accordance with the nature of the invisible God",
                  "((32)) It is, indeed, in accordance with the nature of the invisible God")

raw = re.sub(r"\[\[page \d+\]\]", " ", raw)
raw = re.sub(r"\[ ?\d+\]", "", raw)          # footnote markers like [4]
raw = re.sub(r"\s+", " ", raw)
raw = re.sub(r"\((\d{1,2})\)", r"((\1))", raw)
raw = re.sub(r"\(\(\((\d+)\)\)\)", r"((\1))", raw)

text = raw[raw.find("((1))"):]
parts = re.split(r"\(\((\d{1,2})\)\)\s*", text)
sections, expected = {}, 1
for i in range(1, len(parts), 2):
    n = int(parts[i])
    if n == expected:
        sections[str(n)] = parts[i + 1].strip()
        expected += 1
    else:
        raise SystemExit(f"unexpected marker ({n}), expected ({expected})")
assert len(sections) == 57, len(sections)
sections["57"] = sections["57"].split(" Notes 1.")[0]
(root / "sources/csmv-sections.json").write_text(
    json.dumps(sections, indent=1, ensure_ascii=False), encoding="utf-8")
print("sections:", len(sections))
print({k: len(v.split()) for k, v in sections.items()})
