# Coptic Hub Roadmap

A commit-by-commit plan. Each commit is meant to be independently reviewable, ship-ready on your phone (from commit 1 onwards), and focused on one theme. Effort estimates assume part-time work; double them if you have a busy week.

Each commit answers one question: "what can you demo at the end of it?"

---

## Commit 1 — Shell mockup *(in progress)*
**Theme:** Feel the app on a real phone before any backend work.
**Demo at end:** You hold your phone, tap through every screen, and know whether the layout, colors, and nav feel right. Every screen renders fake but realistic data.

**Scope:**
- Expo + Expo Router + TypeScript + NativeWind
- Coptic theme (incense, nile, parchment, ember, olive palettes)
- Agent registry (`lib/agents.ts`) + icon map + fake fixtures
- Tab bar: Hub / Library / Progress / Settings
- Onboarding carousel introducing all 7 agents
- Visual auth flow (sign-in button just routes to tabs)
- All 7 agents stubbed with screens that match their final shape:
  - **Bible Commentary** — fake grounded chat with clickable citation chips and a refusal example
  - **Sermon Digest** — fake summary card
  - **Psalm Memorization** — dashboard, progress (8 psalms), leaderboard, 4-mode drill
  - **Coptic Language** — fake alphabet grid + drill
  - **Hymn Memorization** — fake hymn list + drill
  - **Rites & Traditions** — fake grounded chat
  - **Sunday School** — fake project list

**Not in this commit:** Supabase, real auth, network calls, persistent storage, real LLM.

**Effort:** ~1 day.

---

## Commit 1.5 — Hub infrastructure
**Theme:** Replace fake with real, but don't add agent logic yet. The hub ships empty but fully working.
**Demo at end:** Sign up, sign in, sign out, persist session across app restart. Go offline → see the offline banner. Write a fake `agent_progress` row → it persists server-side and appears on another device.

**Scope:**
- Supabase project init (`supabase init`, local dev stack)
- Database schema + RLS: `profiles` (with `role` and `class_id`), `agent_progress`, `conversations`, `messages`, `sources`, `source_chunks`, pgvector extension enabled
- Supabase Auth: magic link primary, password secondary, biometric unlock on reopen via `expo-local-authentication`
- `lib/supabase.ts` client with AsyncStorage session persistence and auto-refresh
- `lib/auth.tsx` provider + `useSession` hook + route guards in `_layout.tsx`
- `lib/db/sqlite.ts` — expo-sqlite setup with migration runner
- `lib/db/sync.ts` — offline queue (pending progress writes drain on reconnect, backoff on failure)
- TanStack Query + AsyncStorage persister for server state cache
- `claude-proxy` Edge Function **skeleton**: JWT verification, per-agent model routing, no retrieval yet
- `ingest-source` Edge Function **skeleton**: accepts upload, no parsing yet
- Real sign-in + sign-up + onboarding screens wired to Supabase
- Agent registry loaded from SQLite cache (bundled fallback)
- Progress tab reads from `agent_progress` (shows empty state)
- Library tab reads from `sources` (shows empty state)
- EAS build config for internal TestFlight / Play internal track

**Not in this commit:** Any actual agent content, RAG, drill logic.

**Effort:** ~1-2 weeks.

---

## Commit 2 — Bible Commentary (live, grounded)
**Theme:** First real agent. Prove the grounded RAG pipeline end-to-end.
**Demo at end:** Upload a real PDF commentary → wait for "ready" status → ask a covered question → get a streamed answer with citation chips that open to source + page + excerpt. Ask an uncovered question → get the refusal banner, no hallucinated answer.

**Scope:**
- `ingest-source` Edge Function body:
  - Download PDF from Supabase Storage using service role key
  - Parse per-page text via `unpdf` (Deno-friendly)
  - Chunk: 500–750 tokens per chunk, 100-token overlap, preserving page boundaries
  - Embed via Voyage 3 (1024 dims, Anthropic's recommended embedder)
  - Batch insert to `source_chunks` with the embedding
  - Update `sources.status` → `ready` (or `failed` with error message)
- Realtime subscription in the client so source status transitions animate live
- `claude-proxy` Edge Function body for strict agents:
  - Embed the user question
  - Call the `match_chunks` RPC (pgvector cosine distance < 0.35, top K = 12)
  - If no chunks match → stream a refusal, persist the refusal message, exit
  - Otherwise build Claude `documents` array with `citations: { enabled: true }` on each
  - Stream the response via SSE
  - On `message_stop`, persist final message + normalized citations to `messages.citations` jsonb
- `app/agent/bible-commentary/sources.tsx` — real PDF upload via `expo-document-picker` → Supabase Storage → ingest trigger
- `app/agent/bible-commentary/index.tsx` — real `ChatView` wired to a `useGroundedAsk` hook that opens an SSE stream
- `CitationChip` + `CitationSheet` rendering real citation blocks from Claude's Citations API
- `RefusalBanner` triggered on the refusal event
- Conversation history persisted to `messages` table, cached in SQLite for offline reads
- Anthropic API key stored in Supabase secrets

**Effort:** ~2-4 weeks. The PDF chunking strategy and embedding tuning are where the unpredictable time goes.

---

## Commit 3 — Psalm Memorization (per SPEC.md)
**Theme:** Second real agent. Prove the drill pattern and the teacher/student data model.
**Demo at end:** Pick Psalm 1 → run the 4-mode progression (study → fill-in-blank → first letter → full recitation × 3) → watch mastery state transition → see points accrue and streak update. Fail an attempt → Claude Haiku feedback appears. Airplane mode mid-drill → drill continues, progress queued → reconnect → server catches up.

**Scope:**
- 8 curated psalms loaded from `assets/seed/psalms.json` (public domain translation pending NKJV license decision)
- Exact chunk breakdown from SPEC.md hardcoded per psalm
- `app/agent/psalm-memorization/index.tsx` — dashboard: current psalm/chunk, points, streak, verse of the day
- `app/agent/psalm-memorization/progress.tsx` — 8 psalms with Locked / In Progress / Mastered state
- `app/agent/psalm-memorization/leaderboard.tsx` — reads from a `SECURITY DEFINER` view exposing class-scoped aggregates (points + streaks)
- `app/agent/psalm-memorization/drill.tsx` — 4 drill modes:
  - **Study** — read verse at your own pace, hit "I'm Ready" to continue
  - **Fill in the Blank** — key words removed, type them back, 80% accuracy to pass
  - **First Letter Hints** — only first letter shown, type full words, 80% to pass
  - **Full Recitation** — type from memory, fuzzy text eval (ignore punctuation/case, allow 1-2 char typos per word, no skipped words)
- `lib/psalm/scoring.ts` — fuzzy match + point calculation (word count × mode multiplier: 1.0× blank / 1.5× letters / 2.0× recitation; +50 chunk mastery; +100 first-in-class; daily streak +10/day cap +70)
- `lib/psalm/mastery.ts` — state machine: chunk mastery = 3 correct recitations; psalm mastery = all chunks + 3 full-psalm recitations → unlocks next psalm
- `claude-proxy` routing: Haiku 4.5 for psalm feedback on **failed** attempts only; pre-written pool for successful attempts
- Teacher admin screens: class roster, generate 6-digit login codes (fallback auth), student detail, set verse of the day
- Offline: drill plays from SQLite cache; `progress_queue` drains to `agent_progress` on reconnect

**Effort:** ~2-3 weeks.

---

## Commit 4 — Sermon Digest
**Theme:** Transcript summarization. First loose-grounded agent.
**Demo at end:** Paste a sermon transcript → get an outline, list of themes, and discussion questions you could bring to a small group.

**Scope:**
- Transcript input (paste text first; audio upload + Whisper transcription as a stretch)
- `claude-proxy` routing to Sonnet with a summary-focused system prompt
- Generated summary stored as a conversation with sections rendered as cards
- Export as markdown / share sheet

**Effort:** ~1-2 weeks.

---

## Commit 5 — Coptic Language
**Theme:** Second memorization agent. Reuses drill infrastructure from commit 3.
**Demo at end:** Learn the first 10 Bohairic letters with transliteration and audio. Drill: transliteration → Coptic script recognition with multiple choice and type-in modes.

**Scope:**
- Bohairic alphabet + numbers + core liturgical vocabulary in `assets/seed/coptic.json`
- Drill modes: flashcard, multiple choice, typing (requires Coptic script input — likely a custom on-screen keyboard)
- Audio pronunciation per letter
- Progress tracked in `agent_progress` using the same schema commit 3 established

**Effort:** ~1-2 weeks.

---

## Commit 6 — Hymn Memorization
**Theme:** Third memorization agent, plus audio. Hardest of the memorization agents.
**Demo at end:** Pick a hymn → read the text with synced audio playback → drill mode asks you to recite along and tap each verse as you hit it → progress persists offline.

**Scope:**
- Hymn text library in `assets/seed/hymns.json` with English, Coptic, and Arabic
- Audio files in Supabase Storage, downloaded for offline use via `expo-file-system`
- Playback via `expo-av`
- Timed recitation drill
- Lyric sync data (if we can get it; otherwise verse-level sync is fine)

**Effort:** ~2-3 weeks. Audio playback and offline file management always take longer than they look.

---

## Commit 7 — Rites & Traditions
**Theme:** Second strict-grounded agent. Mostly leverages commit 2's RAG pipeline.
**Demo at end:** Upload reference texts on Coptic rites → ask questions → get cited answers or refusals.

**Scope:**
- Upload UI reused from Bible Commentary
- Chat UI reused from Bible Commentary
- New system prompt for the rites domain
- Optional: seed a curated set of public-domain Coptic reference texts

**Effort:** ~1-2 weeks (most work is done in commit 2).

---

## Commit 8 — Sunday School Projects
**Theme:** Planning tool. CRUD + reminders, different shape from the other agents.
**Demo at end:** Create a project → add tasks → assign to class members → see upcoming due dates → get a local notification on the day.

**Scope:**
- Project + task schema in Supabase
- Planner UI (list + detail)
- Assignee pickers (teachers see their class, students see their own tasks)
- Local notifications via `expo-notifications`
- Claude helper: "draft a lesson plan for this week" → uses a loose system prompt

**Effort:** ~2-3 weeks.

---

## Commit 9 — Polish + TestFlight
**Theme:** Ship to your phone properly. No new features.
**Demo at end:** Real app icon, real splash screen, no visible jank, accessibility labels on every tappable element, error tracking catching real errors, installable via TestFlight / Play internal track.

**Scope:**
- App icon + splash screen (real assets)
- Onboarding polish pass
- Copy pass (every screen, every empty state, every error message)
- Accessibility: VoiceOver / TalkBack labels, font scaling, contrast check
- Sentry or similar for error tracking
- Analytics for understanding what people actually use (PostHog or Plausible)
- EAS build config → TestFlight submission → Play internal testing track

**Effort:** ~1 week.

---

## Beyond v1

Things we've deliberately deferred and would tackle after the v1 is stable on your phone:

- **Public launch** — App Store + Play Store review, marketing site, donation/support flow
- **Multi-parish support** — currently the teacher/student model assumes one class; this scales to many
- **Content moderation** — curated shared source library vs. user-uploaded-only
- **Local LLM option** — on-device Gemma or Llama via MLC for privacy-first users or offline chat
- **Arabic localization** — RTL layout, translated strings, bilingual content
- **Desktop web polish** — the web build exists but isn't the focus; polish it when there's demand

---

## Commit checkpoint grid

| Commit | Theme | Effort | What works at end |
|---|---|---|---|
| 1 | Shell mockup | ~1 day | Every screen renders fake data; feels like an app |
| 1.5 | Hub infrastructure | ~1-2 wk | Real auth, real DB, real offline, no agent logic |
| 2 | Bible Commentary | ~2-4 wk | First grounded RAG agent shipping |
| 3 | Psalm Memorization | ~2-3 wk | First drill agent with mastery + leaderboard |
| 4 | Sermon Digest | ~1-2 wk | Paste-to-summary working |
| 5 | Coptic Language | ~1-2 wk | Alphabet + vocab drills |
| 6 | Hymn Memorization | ~2-3 wk | Text + audio drills with offline playback |
| 7 | Rites & Traditions | ~1-2 wk | Second grounded agent |
| 8 | Sunday School | ~2-3 wk | Project planner with reminders |
| 9 | Polish + TestFlight | ~1 wk | Ship-quality build on your phone |

---

## Risks tracked across the roadmap

These don't block any single commit but need to be resolved before public launch:

- **NKJV licensing** — switch to public-domain translation (KJV or WEB) unless licensed. Affects commit 3 content.
- **Hymn audio licensing** — some Coptic recordings are copyrighted by specific chanters or parishes. Affects commit 6.
- **"No hallucinations" framing** — in-app copy should say "cites every answer, refuses when no source matches" rather than "no hallucinations."
- **Theological authority** — consider a source-vetting model (curated vs. user-uploaded) before public launch. Grounded RAG doesn't solve whose sources are authoritative.
- **Claude API cost at parish scale** — $100-500/month for 100 active users. Free-with-donations vs. per-parish licensing decision affects commit 9 and beyond.
- **Children's data (COPPA / GDPR-K)** — psalm agent targets 7th graders per SPEC.md. Teacher supervision model must be airtight before any real student uses it.
- **App Store review for religious + AI content** — not fatal, but build in time for iteration on rejection.
