"""Fetch the exact NKJV text of every verse used in the game from Bible Gateway
and save it to sources/nkjv-verses.json (the validator checks cards against it).
Usage: python -I scripts/fetch_nkjv.py"""
import html, json, pathlib, re, time, urllib.parse, urllib.request

REFS = ["John 1:1", "John 1:3", "John 1:14", "John 1:18", "John 8:58", "John 10:30",
        "John 14:9", "John 14:28", "John 17:3", "Mark 13:32", "Acts 2:36", "Romans 9:5",
        "Philippians 2:6-7", "Colossians 1:15", "Colossians 1:16-17", "Hebrews 1:3",
        "Hebrews 13:8", "1 John 5:20", "Proverbs 8:22"]
ABBR = {"John": "John", "Mark": "Mark", "Acts": "Acts", "Romans": "Rom", "Philippians": "Phil",
        "Colossians": "Col", "Hebrews": "Heb", "1 John": "1John", "Proverbs": "Prov"}

def verse_text(page, cls):
    # All spans for this verse (a verse can be split across poetry lines).
    parts = re.findall(r'<span (?:id="[^"]*" )?class="text %s"[^>]*>(.*?)</span>(?=\s*(?:<span class="text|</p>|<br|</div>|<span id=|\s*$))' % re.escape(cls), page, re.S)
    out = []
    for p in parts:
        p = re.sub(r"<sup class=['\"](?:crossreference|footnote)['\"].*?</sup>", "", p, flags=re.S)
        p = re.sub(r'<span class="(?:chapternum|versenum)[^"]*">.*?</span>', "", p, flags=re.S)
        p = re.sub(r"<sup class=\"versenum\">.*?</sup>", "", p, flags=re.S)
        p = re.sub(r"<[^>]+>", "", p)
        out.append(html.unescape(p))
    joined = re.sub(r"\[[a-z]{1,2}\]", "", " ".join(out))
    return re.sub(r"\s+", " ", joined).strip()

root = pathlib.Path(__file__).resolve().parent.parent
result = {}
for ref in REFS:
    book, cv = ref.rsplit(" ", 1)
    ch, vs = cv.split(":")
    a, b = (vs.split("-") + [vs])[:2]
    url = "https://www.biblegateway.com/passage/?" + urllib.parse.urlencode({"search": ref, "version": "NKJV"})
    page = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})).read().decode("utf-8")
    page = re.sub(r"<h[1-6][^>]*>.*?</h[1-6]>", "", page, flags=re.S)
    text = " ".join(verse_text(page, f"{ABBR[book]}-{ch}-{v}") for v in range(int(a), int(b) + 1))
    result[ref] = text
    print(f"{ref}: {text}")
    time.sleep(1)
(root / "sources/nkjv-verses.json").write_text(json.dumps(result, indent=1, ensure_ascii=False), encoding="utf-8")
