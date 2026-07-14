# DOMAIN.md — Coptic Hub Domain Knowledge

## What This App Is
**Coptic Hub** is a React Native (Expo) mobile app — a single home for multiple AI-powered spiritual tools for Coptic Orthodox Christians. Each "agent" is a self-contained tool with its own screen stack, data model, and AI behavior. The app targets English-speaking Coptic diaspora, with bilingual (English/Arabic/Coptic) content planned.

**Repo:** `https://github.com/bsaleeb91/Coptic-hub`
**Tech stack:** Expo SDK (latest), Expo Router, TypeScript, NativeWind (TailwindCSS for RN), Supabase (planned)
**Current commit:** 1 — shell mockup with all 7 original agents stubbed (fake data, no backend)

---

## Coptic Orthodox Theology Essentials

### The Church
The Coptic Orthodox Church of Alexandria is one of the oldest Christian churches, founded by St. Mark the Evangelist in Alexandria, Egypt, circa 42 AD. It belongs to Oriental Orthodoxy (not Eastern/Greek Orthodox). The current Pope is H.H. Pope Tawadros II (seated 2012).

### The Seven Holy Sacraments (Mysteries)
1. **Baptism** (Al-Ma'moodeya) — immersion three times in the name of the Trinity
2. **Chrismation / Myron** (Al-Myron) — anointing with holy oil immediately after baptism; full reception of the Holy Spirit
3. **Eucharist** (Al-Eukharistia) — the Body and Blood of Christ; received after fasting
4. **Confession / Repentance** (Al-I'tiraf) — the Sacrament of Repentance; confession to a priest (Father of Confession), absolution, penance
5. **Unction of the Sick** (Mas-hat Al-Marda) — anointing of the sick
6. **Holy Orders** (Al-Kahanoat) — ordination of deacons, priests, bishops
7. **Holy Matrimony** (Eikleel Al-Zawaj) — the crowning ceremony

### Confession in the Coptic Church
- **Name:** Sacrament of Repentance or Sacrament of Confession
- **Who administers:** A priest who is a licensed confessor ("Father of Confession" / Abouna)
- **Frequency:** Recommended before each Communion; practically quarterly or more for devout members
- **Process:**
  1. Examination of conscience (reviewing thoughts, words, deeds, omissions against God and neighbor)
  2. Contrition (genuine sorrow for sin)
  3. Resolution (firm purpose of amendment)
  4. Verbal confession to the priest
  5. Penance assigned by the priest
  6. Absolution pronounced by the priest
- **Examination of conscience categories used in Coptic practice:**
  - Against God: neglecting prayer, blasphemy, not fasting, missing liturgy
  - Against neighbor: anger, envy, lying, gossip (backbiting), theft, lust, pride
  - Against self: gluttony, sloth, impurity, vainglory
  - Sins of omission: failing to help someone in need, neglecting almsgiving

### Fasting in the Coptic Church
Coptic Orthodox Christians follow one of the most extensive fasting traditions in Christianity:
- **Weekly fasts:** Wednesday (betrayal of Christ) and Friday (crucifixion) — no animal products until after the Ninth Hour (~3pm)
- **Major fasts:**
  - Great Lent (55 days before Easter — longest in the world)
  - Apostles' Fast (variable length; begins 15 days after Pentecost)
  - Advent Fast (43 days before Christmas — also called the Fast of the Virgin)
  - Jonah's Fast (3 days, commemoration of Jonah in Nineveh)
  - Fast of the Virgin (15 days in August)
- Fasting = vegan diet + prayer + abstinence from marital relations

### Liturgical Calendar
- The Coptic Calendar (Alexandrian Calendar) has 13 months: 12 months of 30 days + 1 month of 5-6 days (Nasie)
- Coptic New Year (Nayrouz) = September 11
- Major feasts: Nativity (Christmas Jan 7), Epiphany (Jan 19), Palm Sunday, Resurrection (Easter), Pentecost, Feast of the Apostles (July 12)
- The Divine Liturgy is celebrated almost daily in Coptic churches

### Key Figures
- **St. Mark** — founder of the Coptic Church, wrote the Gospel of Mark
- **St. Athanasius the Apostolic** — champion of the Nicene Creed, "father of orthodoxy"
- **St. Cyril of Alexandria** — defined the full humanity and divinity of Christ (Council of Ephesus 431)
- **St. Anthony the Great** — father of Christian monasticism (desert father)
- **St. Pachomius** — founder of cenobitic (communal) monasticism
- **Pope Shenouda III** — transformative 20th century pope; author of many theological books
- **Pope Tawadros II** — current Pope of Alexandria (2012–present)

### Language
- **Coptic (Bohairic dialect)** — the liturgical language; derived from ancient Egyptian
- **Arabic** — home language for Egyptian Coptic families
- **English** — primary language of the diaspora (USA, Canada, Australia, UK)
- In the app: English UI first, Arabic and Coptic content in prayers, hymns, and liturgical texts

---

## App Architecture

### Agent Registry (`lib/agents.ts`)
The single source of truth. Every agent is one entry in `AGENTS: Agent[]`.
Adding a new agent = one entry in `lib/agents.ts` + one folder under `app/agent/{slug}/`.

**Agent fields:**
- `slug` — URL-safe identifier, matches the folder name
- `grounding` — `'strict'` (cite or refuse) | `'loose'` (can summarize/synthesize) | `'none'` (no LLM needed)
- `ui` — `'chat'` | `'drill'` | `'planner'` | `'summary'` (and new: `'guide'` for confession)
- `category` — `'study'` | `'memorization'` | `'reference'` | `'planning'` | `'spiritual'` (new)
- `status` — `'stable'` | `'beta'` | `'stub'`

### Design System (`lib/theme.ts` + `tailwind.config.js`)
Coptic-inspired palette — always use these names, never raw hex:
- **incense** (amber/saffron) — primary accent, buttons, highlights
- **nile** (deep teal/blue-green) — surfaces, navigation, headers
- **parchment** (warm off-white) — backgrounds, text on dark surfaces
- **ember** (deep red) — refusals, destructive actions, warnings
- **olive** (green) — success, mastered state, completion

### Folder Structure
```
app/
  (auth)/         Sign-in, onboarding
  (tabs)/         Hub home, Library, Progress, Settings
  agent/
    _layout.tsx   Shared agent stack navigator
    {slug}/       Per-agent screens
lib/
  agents.ts       Agent registry (source of truth)
  fixtures.ts     Fake data (stub phase only)
  theme.ts        Color tokens for non-Tailwind consumers
  icons.ts        Lucide icon map
components/
  AgentCard       Hub card for each agent
  ChatView        Shared grounded chat UI
  CitationChip    Inline citation with source/page
  DrillCard       Memorization drill UI
```

---

## The 8 Agents

### 1. Bible Commentary (slug: `bible-commentary`)
- **Status:** Commit 1 (stub) → Commit 2 (live RAG)
- **Grounding:** strict (pgvector + Claude Citations API)
- **UI:** chat
- **Pipeline:** User uploads PDF → Voyage 3 embeddings → pgvector in Supabase → Claude Sonnet with citations

### 2. Sermon Digest (slug: `sermon-digest`)
- **Status:** Commit 1 (stub) → Commit 4
- **Grounding:** loose
- **UI:** summary
- **Pipeline:** Paste transcript or upload audio → Claude Sonnet summarizes → outline, themes, discussion questions

### 3. Psalm Memorization (slug: `psalm-memorization`)
- **Status:** Commit 1 (stub) → Commit 3
- **Grounding:** none
- **UI:** drill
- **4 modes:** Study → Fill-in-blank → First letter → Full recitation
- **8 psalms** seeded from `assets/seed/psalms.json`
- **Scoring:** word count × mode multiplier (1.0/1.5/2.0) + mastery bonuses

### 4. Coptic Language (slug: `coptic-language`)
- **Status:** Commit 1 (stub) → Commit 5
- **Grounding:** none
- **UI:** drill
- **Content:** Bohairic alphabet, numbers, core liturgical vocabulary

### 5. Hymn Memorization (slug: `hymn-memorization`)
- **Status:** Commit 1 (stub) → Commit 6
- **Grounding:** none
- **UI:** drill
- **Content:** Hymn text (English/Coptic/Arabic) + audio playback via expo-av

### 6. Rites & Traditions (slug: `rites-traditions`)
- **Status:** Commit 1 (stub) → Commit 7
- **Grounding:** strict (same RAG pipeline as Bible Commentary)
- **UI:** chat
- **Content:** Coptic rites, feasts, fasting rules, liturgical practice

### 7. Sunday School Projects (slug: `sunday-school`)
- **Status:** Commit 1 (stub) → Commit 8
- **Grounding:** loose
- **UI:** planner
- **Content:** Lesson plans, project tracking, class rosters, reminders

### 8. Confession Preparation (slug: `confession-prep`) — NEW
- **Status:** Not yet scaffolded — design + build in progress
- **Grounding:** none
- **UI:** `guide` (new UI kind — step-by-step spiritual guide, not chat)
- **Category:** `spiritual` (new category)
- **Privacy:** ALL data stays in local SQLite — NEVER syncs to Supabase
- **Features:**
  - Pre-confession prayer (text + audio option)
  - Examination of conscience by category (God / Neighbor / Self / Omissions)
  - Private notes per category (local only)
  - Absolution preparation checklist
  - Post-confession thanksgiving prayer
  - "Reset for next confession" button (clears local notes only)
- **Theology:** Follows the Coptic Orthodox Sacrament of Repentance as described in DOMAIN.md
- **Design tone:** solemn, quiet — use parchment backgrounds, nile accents, no gamification

---

## Commit Roadmap Summary

| Commit | Theme | Status |
|--------|-------|--------|
| 1 | Shell mockup (all 7 agents stubbed) | ✅ Complete |
| 1.5 | Supabase infra (auth, DB, offline) | 🔲 Next |
| 2 | Bible Commentary live (RAG) | 🔲 Planned |
| 3 | Psalm Memorization live | 🔲 Planned |
| 4 | Sermon Digest live | 🔲 Planned |
| 5 | Coptic Language live | 🔲 Planned |
| 6 | Hymn Memorization live | 🔲 Planned |
| 7 | Rites & Traditions live | 🔲 Planned |
| 8 | Sunday School live | 🔲 Planned |
| 9 | Polish + TestFlight | 🔲 Planned |
| + | Confession Prep (new 8th agent) | 🔲 Design in progress |
