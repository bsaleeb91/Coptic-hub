"""Export the source texts from the Bible Commentary database into sources/.

The C.S.M.V. translation is copyrighted, so these files are gitignored and stay
on this machine. Run from the project root:
    python -I scripts/export_sources.py
    python -I scripts/split_sources.py
    python -I scripts/split_orations.py
"""
import pathlib, sqlite3

root = pathlib.Path(__file__).resolve().parent.parent
db = root.parent / "commentary.db"
files = {
    "csmv-svs.txt": "003. On the Incarnation - Athanasius of Alexandria.pdf",  # SVS printing
    "csmv-web.txt": "On the Incarnation - Saint Athanasius.pdf",              # same translation, cleaner text
    "orations.txt": "Athanasius- 4 Discourses Against the Arians.pdf",        # NPNF, public domain
}
c = sqlite3.connect(db)
(root / "sources").mkdir(exist_ok=True)
for out, name in files.items():
    rows = c.execute("select page_number, chunk_text from chunks where filename=? order by page_number, id", (name,)).fetchall()
    with open(root / "sources" / out, "w", encoding="utf-8") as f:
        for page, text in rows:
            f.write(f"\n\n[[page {page}]]\n{text}")
    print(out, len(rows), "chunks")
