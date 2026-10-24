# Nicaea

A card battle game about the Council of Nicaea (325). You play Athanasius; the
computer plays Arius, who quotes real Scripture. You win bishops by answering
with the right reading, and build the Creed of 325 as you go.

**Status:** Phase 2 (playable prototype) done. Content still awaiting the
teacher's theology review, so the game shows a DRAFT banner.

Live: https://nicaea-iota.vercel.app (Vercel project `nicaea`).

## Commands

```
npm install
npm run validate   # checks all content; fails on errors
npm run review     # regenerates CONTENT_REVIEW.md from data/
npm run dev        # play locally (also on your phone via the Network URL)
npm test           # rules engine tests
npm run simulate   # balance check: plays 2000 matches with simple bots
npm run build      # validate + type-check + build to dist/
```

Replay a specific match with `?seed=123` in the URL (the end screen shows the
match number).

## Deploy

Static site on Vercel. From this folder: `vercel deploy` for a preview,
`vercel deploy --prod` to update the live link. `.vercelignore` keeps the
copyrighted source texts out of the upload.

## Source texts

Quotes are checked against texts exported from the Bible Commentary database
(`../commentary.db`). The C.S.M.V. translation of *On the Incarnation* is
copyrighted, so the extracted text is gitignored and stays on this machine:

```
python -I scripts/export_sources.py
python -I scripts/split_sources.py     # On the Incarnation -> sections 1-57
python -I scripts/split_orations.py    # Against the Arians -> discourse/section
python -I scripts/fetch_nkjv.py        # NKJV text of every verse used (Bible Gateway)
```

Without `sources/`, `npm run validate` still runs but skips quote checks.

- *On the Incarnation*: C.S.M.V. translation (SVS Press). Quotes are matched
  against both the web copy and the printed SVS edition.
- *Against the Arians*: NPNF 2nd Series Vol. 4, public domain.
- Creed of 325: Eusebius's letter, NPNF 2nd Series Vol. 4 (Robertson), public
  domain. Saved in `sources/creed-325.md`.

See `CONTENT_GUIDE.md` to edit cards and `ROADMAP.md` for what comes next.
