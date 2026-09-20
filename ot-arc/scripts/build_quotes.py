"""Build content/quotes.json by copying quote text directly out of commentary.db.

Nothing here is typed from memory: each quote is located in its source chunk by a
start phrase and an end phrase, and the text between them (inclusive) is copied.
The only permitted edits are declared per quote in `fix` (PDF extraction artifacts:
line-break hyphens, footnote numerals, page markers) plus global normalization of
whitespace, ligatures and the scanner's broken quote marks. Every edit is recorded
in the output so it can be audited.

Usage: python scripts/build_quotes.py [path/to/commentary.db]
"""
import json
import re
import sqlite3
import sys
from pathlib import Path

DB = sys.argv[1] if len(sys.argv) > 1 else str(Path.home() / "projects" / "commentary.db")
OUT = Path(__file__).resolve().parent.parent / "content" / "quotes.json"

GLOBAL_NORMALIZE = {"ﬁ": "fi", "ﬂ": "fl", "―": "“", "‖": "”"}


def norm(text):
    for a, b in GLOBAL_NORMALIZE.items():
        text = text.replace(a, b)
    return re.sub(r"\s+", " ", text).strip()


MACARIUS_FLAG = (
    "MACARIUS FLAG: the database's source is A. J. Mason's 1921 translation, titled 'Fifty Spiritual "
    "Homilies of St. Macarius the Egyptian' (i.e. Macarius the Great); Mason's introduction defends that "
    "attribution. Modern scholarship assigns these homilies to an anonymous Syrian author, 'Pseudo-Macarius', "
    "and the Ancient Christian Commentary volumes in the same database cite them that way. Coptic tradition "
    "holds them as St. Macarius the Great's."
)

# Each segment: (start phrase, end phrase). Both must occur in the chunk after
# normalization and `fix`. Multiple segments are joined with " ... " (ellipsis).
QUOTES = [
    # ---------------- era-1 : Genesis 3 ----------------
    dict(id="malaty-genesis-3-god-approached",
         father="Fr. Tadros Y. Malaty", voice="commentator",
         work="Commentary on Genesis, ch. 3 (\"God's care for man\")",
         scripture="Genesis 3:8-9", attaches_to="era-1", chunk=174180,
         segments=[("God did not wait for man to come to Him", "to recognize his sins and to confess them.")]),
    dict(id="ambrose-repentance-where-are-you",
         father="St. Ambrose of Milan", voice="father",
         work="Concerning Repentance, Book 2 (as cited by Fr. Tadros Malaty, Commentary on Job)",
         scripture="Genesis 3:9", attaches_to="era-1", chunk=180685,
         fix={"longed to see1?!": "longed to see?!"},
         segments=[("“Where are you hiding?", "whom you always longed to see?!”")]),
    dict(id="athanasius-incarnation-6",
         father="St. Athanasius the Apostolic", voice="father",
         work="On the Incarnation, §6",
         scripture="Genesis 3 (the Fall and its consequence)", attaches_to="era-1", chunk=7932,
         segments=[("Surely it would have been better never to have been created at all", "to be neglected and perish;"),
                   ("It was impossible, therefore, that God should leave man", "unfitting and unworthy of Himself.")]),

    # ---------------- era-2 : Exodus 25:8 ----------------
    dict(id="malaty-exodus-intro-god-came-down",
         father="Fr. Tadros Y. Malaty", voice="commentator",
         work="Commentary on Exodus, Introduction (\"The book of the Passover\")",
         scripture="Exodus 3:8; Exodus 25:8", attaches_to="era-2", chunk=174705,
         segments=[("He came down to His people, as a Cloud", "and in the tabernacle to dwell among them.")]),
    dict(id="malaty-exodus-intro-bondage-of-lust",
         father="Fr. Tadros Y. Malaty", voice="commentator",
         work="Commentary on Exodus, Introduction (\"The book of freedom\")",
         scripture="Exodus 16:3; Exodus 32", attaches_to="era-2", chunk=174706,
         segments=[("God delivered them through Moses from the bondage of Pharaoh.", "that had remained deep in their hearts (Ex. 32).")]),
    dict(id="ephrem-exodus-25-9",
         father="St. Ephrem the Syrian", voice="father",
         work="Commentary on Exodus 25.1 (as cited in Ancient Christian Commentary on Scripture, OT vol. 3)",
         scripture="Exodus 25:9", attaches_to="era-2", chunk=167759,
         segments=[("By saying [to him],", "the perfect prototype which lasts forever.")]),

    # ---------------- era-3 : 1 Kings 8:27 ----------------
    dict(id="clement-alexandria-fragment-1kings-8-27",
         father="Clement of Alexandria", voice="father",
         work="Fragment 12.3 (as cited in Ancient Christian Commentary on Scripture, OT vol. 5)",
         scripture="1 Kings 8:27", attaches_to="era-3", chunk=163222,
         segments=[("“Will God in very deed dwell with humans on the earth?”", "build … a new temple.")]),
    dict(id="cyril-micah-4-rejected-gods-reign",
         father="St. Cyril of Alexandria", voice="father",
         work="Commentary on Micah 4 (Commentary on the Twelve Prophets, FOTC 116, p. 229)",
         scripture="1 Samuel 8:5-7 (cited on Micah 4:9)", attaches_to="era-3", chunk=44839,
         fix={"af- ter": "after", "conduct- ed": "conducted"},
         segments=[("The God of all had been king of the people of Israel", "acting as mediator."),
                   ("When affairs were like this for them", "they shook off the yoke, as it were, of God’s reign")]),
    dict(id="clement-alexandria-educator-1sam-16-7",
         father="Clement of Alexandria", voice="father",
         work="Christ the Educator 3.2.11-12 (as cited in Ancient Christian Commentary on Scripture, OT vol. 4)",
         scripture="1 Samuel 16:7", attaches_to="era-3", chunk=162779,
         segments=[("He finally anointed not the one who was fair in body", "the one who was fair of soul.")]),

    # ---------------- era-4 : Ezekiel 10 ----------------
    dict(id="malaty-ezekiel-10-glory-departs",
         father="Fr. Tadros Y. Malaty", voice="commentator",
         work="Commentary on Ezekiel, ch. 10 (\"The divine glory departs from the house of the Lord\")",
         scripture="Ezekiel 10", attaches_to="era-4", chunk=186850,
         segments=[("It was not possible for the Lord to dwell", "where man persists on doing evil;"),
                   ("It was imperative for God to depart from His old temple", "made by His Holy Spirit.")]),
    dict(id="malaty-ezekiel-11-waiting-for-one-soul",
         father="Fr. Tadros Y. Malaty", voice="commentator",
         work="Commentary on Ezekiel, ch. 11",
         scripture="Ezekiel 11:16-20", attaches_to="era-4", chunk=186856,
         segments=[("He is waiting for one single soul in captivity,", "not to avenge, but to mend and renew!")]),
    dict(id="cyril-micah-4-brought-back",
         father="St. Cyril of Alexandria", voice="father",
         work="Commentary on Micah 4 (Commentary on the Twelve Prophets, FOTC 116, p. 230)",
         scripture="Micah 4:10 (the exile to Babylon)", attaches_to="era-4", chunk=44840,
         fix={"es- cape": "escape"},
         segments=[("But he does not leave it completely without consolation;", "brought back through God’s compassion.")]),

    # ---------------- thread-mercy : God as Father ----------------
    dict(id="clement-alexandria-instructor-1-8",
         father="Clement of Alexandria", voice="father",
         work="The Instructor (Paedagogus), Book I, ch. 8",
         scripture="(on God's justice and goodness)", attaches_to="thread-mercy", chunk=19834,
         segments=[("I will grant that He punishes the disobedient", "I will not grant that He wishes to take vengeance.")]),
    dict(id="antony-letter-2-god-visits",
         father="St. Antony the Great", voice="father",
         work="Letter Two (trans. Samuel Rubenson)",
         scripture="(on God's repeated visitations)", attaches_to="thread-mercy", chunk=73438,
         segments=[("God did not visit his creatures only once,", "God embraces him in his benevolence, grace and Spirit.")]),

    # ---------------- thread-sacrifice : God as Teacher ----------------
    dict(id="malaty-genesis-intro-coats-of-skin",
         father="Fr. Tadros Y. Malaty", voice="commentator",
         work="Introduction to Genesis, ch. 3 (\"God's Concern for Man\")",
         scripture="Genesis 3:21", attaches_to="thread-sacrifice", chunk=174641,
         segments=[("God gave them coats of skin not silk,", "symbolic of Christ's sacrifice on the cross.")]),
    dict(id="cyril-glaphyra-genesis-isaac",
         father="St. Cyril of Alexandria", voice="father",
         work="Glaphyra on Genesis, Book 3 (FOTC 137, p. 156)",
         scripture="Genesis 22:6", attaches_to="thread-sacrifice", chunk=25899,
         fix={"car- rying116": "carrying", " [144]": ""},
         segments=[("As for the boy, Isaac, the wood for the burnt offering", "suffered outside the gate.")]),

    # ---------------- thread-dwelling : God as Neighbor ----------------
    dict(id="malaty-haggai-preface",
         father="Fr. Tadros Y. Malaty", voice="commentator",
         work="Commentary on Haggai, Preface",
         scripture="Haggai", attaches_to="thread-dwelling", chunk=188163,
         segments=[("As though it is a divine call to every soul", "and her depths, a sanctuary for Him.")]),
    dict(id="antony-letter-2-moses-built-the-house",
         father="St. Antony the Great", voice="father",
         work="Letter Two (trans. Samuel Rubenson)",
         scripture="(Moses and the prophets)", attaches_to="thread-dwelling", chunk=73438,
         segments=[("Moses built the house, yet did not finish it.", "could not complete it and likewise they left and died.")]),
    dict(id="macarius-homily-47-throne-house-temple",
         father="St. Macarius the Great (the Egyptian)", voice="father",
         work="Fifty Spiritual Homilies, Homily 47, §14 (trans. A. J. Mason, 1921)",
         scripture="Exodus 14-15, read of the soul", attaches_to="thread-dwelling", chunk=72537,
         note=MACARIUS_FLAG,
         segments=[("Glory to Him who has delivered the soul from the bondage of Pharaoh,", "and His pure bride")]),

    # ---------------- closing : John 1:14 (id added; not in the handoff's table) ----------------
    dict(id="athanasius-incarnation-9-king-in-the-city",
         father="St. Athanasius the Apostolic", voice="father",
         work="On the Incarnation, §9",
         scripture="John 1:14", attaches_to="closing", chunk=7935,
         segments=[("You know how it is when some great king enters a large city", "cease to molest it."),
                   ("Even so is it with the King of all;", "dwelt in one body amidst the many,")]),
    dict(id="cyril-john-1-14-dwelt-in-flesh",
         father="St. Cyril of Alexandria", voice="father",
         work="Commentary on John, Book I (on John 1:14)",
         scripture="John 1:14", attaches_to="closing", chunk=28078,
         fix={"the Col. it~. Holy Virgin": "the Holy Virgin"},
         segments=[("you might not suppose that He is transformed into flesh,", "the Temple that is from the Holy Virgin.")]),
]


def main():
    con = sqlite3.connect(DB)
    out, problems = [], []
    for q in QUOTES:
        row = con.execute(
            "select source, filename, page_number, chunk_text from chunks where id=?", (q["chunk"],)
        ).fetchone()
        if not row:
            problems.append(f"{q['id']}: chunk {q['chunk']} missing")
            continue
        source, filename, page, raw = row
        text = norm(raw)
        for a, b in q.get("fix", {}).items():
            if a not in text:
                problems.append(f"{q['id']}: fix target {a!r} not found")
            text = text.replace(a, b)
        parts = []
        for start, end in q["segments"]:
            i = text.find(start)
            j = text.find(end, i) if i >= 0 else -1
            if i < 0 or j < 0:
                problems.append(f"{q['id']}: segment {start[:40]!r} .. {end[-30:]!r} not found")
                break
            parts.append(text[i:j + len(end)])
        else:
            rec = {k: q[k] for k in ("id", "father", "work", "scripture")}
            quote = " … ".join(parts)
            # Mark truncation honestly: excerpt starting mid-sentence or ending without a full stop.
            if quote[0].islower():
                quote = "…" + quote
            if quote[-1] not in ".!?”)":
                quote = quote.rstrip(",;:") + " …"
            rec["quote"] = quote
            rec["attaches_to"] = q["attaches_to"]
            rec["source"] = (f"~/projects/commentary.db | chunks.id={q['chunk']} | "
                             f"{source} / {filename} | PDF p. {page}")
            rec["voice"] = q["voice"]
            if q.get("fix"):
                rec["extraction_fixes"] = [f"{a!r} -> {b!r}" for a, b in q["fix"].items()]
            if q.get("note"):
                rec["note"] = q["note"]
            out.append(rec)
    if problems:
        print("PROBLEMS:\n  " + "\n  ".join(problems))
        sys.exit(1)

    slots = {"era-1", "era-2", "era-3", "era-4", "thread-mercy", "thread-sacrifice", "thread-dwelling"}
    covered = {r["attaches_to"] for r in out}
    doc = {
        "_about": (
            "Quotes copied verbatim from commentary.db chunks (see `source`). Global normalization: whitespace "
            "collapsed, ligatures fi/fl expanded, the scanner's quote marks U+2015/U+2016 shown as curly quotes. "
            "Per-quote PDF artifact fixes are listed in `extraction_fixes`. voice='commentator' marks "
            "Fr. Tadros Malaty's own words (he is not a church father). An ellipsis joins two excerpts from the "
            "same chunk; a leading/trailing ellipsis marks an excerpt cut mid-sentence. Rebuild with: python scripts/build_quotes.py"
        ),
        "quotes": out,
        "unmatched": sorted(slots - covered),
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(out)} quotes -> {OUT}; unmatched: {doc['unmatched']}")


if __name__ == "__main__":
    main()
