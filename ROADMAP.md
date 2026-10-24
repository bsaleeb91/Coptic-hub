# Coptic Hub Roadmap

## Next Up — post-launch ideas

Not scheduled yet — captured here so they aren't lost between sessions.

### Queued 2026-09-07

**Encrypt all personally identifiable information.**
The `tweetnacl` box-keypair infrastructure already exists in `lib/crypto.ts` and
is used for confession entries (`lib/confession/store.ts`) and prayer requests.
This extends the same treatment to the rest of the PII surface — profile fields
(full name, the address fields on `pastoral_contacts`, phone, date of birth), priest
pastoral notes and private encounter notes, and journal entries — so that what
sits in Supabase is ciphertext rather than plaintext the server can read.
Open questions to settle first:
  - Key custody and recovery. Confession already has a PIN-wrapped keypair
    backup (`encryptKeypairWithPIN`); a lost key currently means lost data.
    Encrypting profile identity fields raises the stakes on that considerably.
  - What must stay queryable server-side. Encrypted columns can't be searched,
    sorted, or joined — this affects the priest roster, member lookup, and any
    admin dashboard listing. Decide per field whether it's encrypted, hashed
    for lookup, or deliberately left in the clear.
  - Migration path for existing rows now that the app is live.

**Show the privacy summary during onboarding.**
The rest of "say plainly what is private" shipped (see Shipped 2026-10-14).
`PRIVACY_COPY.onboarding` / `onboardingTitle` are written in
`lib/privacy-copy.ts` but no screen shows them: add the step to the first-run
tutorial, before the first entry is made.

**Sort churches by distance in the picker.**
The picker searches by name and city (2026-09-07), and `churches` now carries
structured `address_line1 / city / state / zip / country` instead of one free
text blob — which is the prerequisite for ordering parishes by how far away
they are, rather than alphabetically. What is still missing:
  - Latitude and longitude on `churches`. Geocode on save in the admin form
    rather than at read time, so the picker stays a single cheap query.
  - A geocoding provider, and a decision about who pays for it. Nominatim is
    free with a usage policy that a low-volume admin form fits comfortably;
    Google and Mapbox are paid but better on partial or misspelled addresses.
  - Backfill for the churches already entered, including the rows still holding
    only legacy free text.
  - Location permission, and what the picker does without it. Distance should
    be an optional ordering on top of the existing alphabetical list, never a
    requirement — a member who declines the permission must still be able to
    find their parish, and refusing should cost them nothing.
  - Whether distance is shown as a number ("4.2 mi") or only used for ordering.
    A visible number invites the question of accuracy, which a geocoded street
    address cannot really answer.

**Connecting with friends (v2 or v3).**
The psalm leaderboard is scoped to a servant's class, which is the right first
circle — the members already know each other and a servant is accountable for
it. Friends is a different shape: a self-chosen graph that crosses class and
parish boundaries, and it cannot simply reuse the class query.
  - A friendship is mutual and requested, so it needs invite, accept, decline,
    remove and block — five states, not a boolean. Without block, this becomes
    a way to follow someone who does not want to be followed.
  - Children are the main users of the psalm agent. Adult-to-minor friend
    requests need a rule decided before any code: servant or FOC approval,
    restriction to same-class or same-parish, or no cross-age requests at all.
  - Discovery is the hard half. Search by name across all parishes is a
    directory of minors; invite codes or QR between two people already
    together avoids that entirely and is probably the answer.
  - Leaderboard consent is currently one flag meaning "my class". Friends adds
    a second audience, and the two should not be silently merged — a member who
    agreed to be seen by classmates has not agreed to be seen by someone from
    another parish.
  - Decide what a friend sees: the same streak and memorized count the class
    board shows, or less.

### Queued 2026-10-14

**Require a church at sign-up.**
`handle_new_user` inserts only `id`, `full_name` and `role`, and `church_id` is
written in exactly one place — the church picker on the Profile screen
(`app/profile.tsx`). So every account starts unassigned and most stay that way;
`get_church_breakdown` had to grow an "unassigned" row to make the per-church
counts add up. Move the choice into sign-up:
  - Reuse the existing church picker (name/city search) as a sign-up step, for
    every role, before the account is created.
  - Show each church's full address (street, city, state, zip) in the sign-up
    list and on the confirmation, not only the name — some parishes have two
    locations under the same name (STSA: Leesburg and Arlington), and the
    address is the only way to tell them apart. The Profile screen should show
    at least the city next to the chosen church for the same reason.
  - A "My church isn't listed" path that still lets the person in — a request to
    add the parish, kept unassigned until an admin adds it — rather than a dead
    end that loses the sign-up.
  - Send the choice through sign-up metadata so `handle_new_user` writes
    `church_id` in the same transaction, instead of a second update after.
  - Existing unassigned accounts: a one-time "Choose your church" prompt on next
    launch, skippable, rather than blocking the app.
  - Decide whether a priest's church is fixed or editable, and whether a member's
    church must match their Father of Confession's (probably not — members
    visit, move, and keep their FOC).

**Import congregants from a CSV.**
Let a priest (or an admin, on a church's behalf) bring an existing parish list
in, instead of every member finding the app on their own. Open questions first:
  - An import cannot create accounts — a member needs their own sign-in and their
    own encryption key. What it creates is a pending invitation per row: name,
    email and/or phone, church, and the priest as their future FOC.
  - Consent. The FOC link must stay member-initiated (it gates what the priest
    can see). An imported row should pre-fill the link for the member to
    *accept* on first sign-in, never attach them silently.
  - Delivery: invitation email via a server-side function (needs the service
    role, so it can't run from the app), a shareable per-person code, or both.
  - Format and validation: a fixed template with required columns, a preview of
    what will be created, and duplicate detection against existing accounts and
    earlier imports (same email, or same name + phone).
  - Data minimisation: import only what sign-up needs. Addresses, birthdays and
    family details belong to the member to enter (and are encrypted in the app),
    not to a spreadsheet uploaded in plaintext.
  - Children and family members on the parish list — whether they become their
    own invitations or are left for the parent to add.
  - What happens to invitations nobody accepts: expiry, and a way for the priest
    to see and withdraw them.

**Enforce the invite code on the server.**
Joining a flock (or a servant's class) is a plain update of the member's own
`foc_id` / `servant_id`; the six-character code is only checked in the app, and
priest ids are readable by any signed-in user. A stranger can therefore attach
to any priest's flock — see his appointment types and availability, request
appointments, appear on his roster.
  - `join_flock(code)` / `join_class(code)` security-definer RPCs that look the
    code up and set the link, so the code never has to be readable.
  - Then stop members writing `foc_id` / `servant_id` directly (a trigger or
    column grant), and switch `link-to-foc.tsx` and the servant join to the RPCs.
  - Old builds that update the column directly break at that point — ship the
    app change first, enforce after 1.0.0 retires.

**Pitch page: what a priest needs before saying yes.**
  - "Up and running in an afternoon" — download, share the invite code, members
    choose him.
  - A short priest FAQ: can the bishop or the church see my notes; what if I
    lose my phone; can the people who run Nepsis read anything.
  - One or two real quotes from priests using it, with permission.
  - Cost, and what happens to a parish's data if it stops using Nepsis.

### Queued 2026-10-20

**Give each account its own encryption key on the phone.**
*(Built 2026-10-21, not yet deployed — no build includes it yet.)* Every account signed in on a
device shared one key slot, so deleting one account erased the key another
account still needed — after the deletion test, the main account asked for its
Recovery PIN. A second account on a shared family phone also reused the first
account's key.
  - Each account now keeps its key in its own slot; deleting an account clears
    only its own.
  - Existing installs: the old shared key is copied to an account only if its
    public key matches that account's profile, and the shared copy is left for
    any other account that still needs it.
  - Test on a phone before submitting: update over the current build without
    being asked for the PIN; two accounts on one phone; delete one and the
    other still opens its journal.

**Provide EU trader status so Nepsis can be sold in the EU.**
All 27 EU countries show "Trader Status Not Provided" in App Store Connect
(Digital Services Act), so the app is not available anywhere in the EU. It is
a form under Business in App Store Connect, not an app change.
  - Declaring as a trader publishes an address, phone and email on the App
    Store product page — decide which address and phone are acceptable to show
    before filling it in.

**Hide priests' activity timestamps from other users.**
`last_seen_at` and `last_confession_at` on a priest's profile row are readable
by any signed-in user (the profiles column grants from 2026-10-13 kept them).
  - Drop them from the `authenticated` column grant, and serve what a member
    genuinely needs (if anything) through a security-definer RPC scoped to
    their own FOC.
  - Check which screens read them before revoking, and that old builds degrade
    rather than fail.

**Review access rules on the contact and family tables.**
The 2026-10-14 policy review covered profiles, encounters and canons but not
`pastoral_contacts` and the family tables. Contact/family details are still
dual-written (sealed payload plus a plaintext copy) until build 17 retires.
  - Confirm every policy is own-row or own-flock only, with a PGlite test like
    the earlier lockdown.
  - Once 1.0.0 (build 17) is retired, stop the plaintext copy and clear it.

**Tidy up after the October security rollout.**
  - Delete the `Coptic-hub-webmerge` and `Coptic-hub-keyfix` worktree folders.
  - Remove merged branches (`fix/key-backup-exposure`,
    `feat/private-encounter-notes`, `feat/slow-pin-kdf`, `feat/encrypt-journal`).
  - Commit the remaining notes in `poimen/SECURITY-ROLLOUT-2026-10.md`.

## Shipped

Kept here so a finished item is not queued again. Outside the "Next Up" block
on purpose: scripts/gen-roadmap.mjs stops at the next top-level heading, so
none of this reaches the in-app roadmap.

### Shipped 2026-10-23

**Rework the admin view.**
`app/admin.tsx` is split into Overview, Feedback, Survey and Churches tabs; the
open tab is kept in the URL (`?tab=feedback`).
  - Survey shows each response in full below the distributions, with role,
    platform, version and date. Role stays on the row (decided 2026-10-23).
  - Feedback pages 50 at a time by date with "Load more"; the open count covers
    the whole table. Survey loads every response so the percentages are
    complete, and the list shows 20 at a time.
  - Activity chart takes 3, 6 or 12 months or all time, through
    `get_monthly_activity(p_months)`
    (`20261023010000_monthly_activity_range.sql`, applied 2026-10-23 with
    `supabase db query` — the October migrations are not in the remote
    history, so `db push` would re-run them).
  - CSV export of feedback and survey (`lib/csv.ts`). No user ids; text that
    a spreadsheet would run as a formula is kept as text.
  - Fixed the chart bars, which had collapsed to zero height on web.
  - Member lookup: decided not to build (2026-10-23).

### Shipped 2026-10-21

**Delete my account.**
Settings → Delete account (`app/delete-account.tsx`) removes the profile, the
data keyed to it, and the auth user through an Edge Function, then clears the
account's on-device data. Shipped in 1.1.0 (build 23), approved by Apple
2026-10-21 after the 2026-10-16 rejection under guideline 5.1.1(v).

### Shipped 2026-10-14

**Say plainly, in more than one place, what is private and what stays on the device.**
All wording lives in `lib/privacy-copy.ts` and is shown on sign-up
(`sign-in.tsx`), in Settings → "Your data & privacy" (`profile.tsx`), inline on
Prayer, Journal and Canon, and in the vitals-sharing consent. Each names what
is encrypted, what leaves the device, and who can see it. Onboarding is the one
place still missing — queued separately.

### Shipped 2026-09-15

**Reminder notifications for Psalms and Canon.**
Local notifications only — `expo-notifications` schedules them on the phone and
there is no push server, no device token, and nothing about a rule or a review
queue leaving the device to make one happen. Both are off until switched on in
`app/reminders.tsx`, each at a time the member picks.
  - Each day is scheduled individually over a rolling 14-day window
    (`lib/reminders/schedule.ts`) rather than as one repeating daily trigger,
    so a reminder can name what is actually due that day — the two services
    standing in the rule, the number of portions up for review — instead of
    repeating one fixed sentence until it becomes wallpaper.
  - A day with nothing due is not scheduled at all, and today's canon reminder
    is dropped once the canon is complete. Silence on an empty day is what
    makes the reminder mean something on a full one.
  - The window is rebuilt on every foreground (`components/ReminderSync.tsx`),
    which is what keeps it in step with a rule edit, a finished passage or a
    service checked off — none of which need to know reminders exist.
  - The phrasing is unit-tested (`lib/reminders/phrasing.test.ts`): a
    notification is read once, on a lock screen, and cannot be corrected after
    the phone has said it.
  - REQUIRES A NATIVE REBUILD. expo-notifications is a native module, so this
    cannot reach members over the air — it ships with the next EAS build.

**Tutorial of the app, especially the Confession module.**
The role tour (congregant / priest / servant) gave Confession one step out of
seven, which said what the tab was for and nothing about how to use it. The tab
now has its own six-step walkthrough (`MODULE_TUTORIALS.confession` in
`lib/tutorial.ts`), running once on first open and replayable from a "How this
tab works" link on the hub.
  - It teaches the order the four entry points are meant to be used in —
    journal as life happens, examination before you go, notes while you are
    there — which the cards themselves do not suggest.
  - `lib/tutorial-store.ts` is now keyed by `TutorialKey` rather than by role,
    so module walkthroughs sit alongside role tours. Role keys are unchanged,
    so nobody who has taken one is shown it again.
  - Copy rule held throughout: the tab prepares someone for the sacrament and
    never stands in for it, and the one thing that does leave the phone (the
    date) is named alongside the things that do not.

### Shipped 2026-09-13

**Remove the priest approval process.**
Took the first option: a priest is a priest from sign-up, and the consent gate
moved from the admin to the member — none of a congregant's data is visible to
a priest until the congregant links to him as Father of Confession.
  - Commit `fd8fb3e` and `supabase/migrations/20260913010000_remove_priest_approval.sql`;
    the SQL was applied in prod by hand, ahead of the code (confirmed
    2026-10-08: a new priest's row read `role = 'priest'` immediately).
  - Reached `nepsis-main` with the build 21 merge (`92970c1`). The `/admin`
    priest-request queue and the sign-in "pending verification" copy are gone.
  - Invite codes still work: `on_profile_ensure_invite_code` runs on insert, so
    a profile created straight into `role = 'priest'` still gets its code.

### Shipped 2026-09-07

**In-app feedback mechanism built into the app.**
`app/feedback.tsx`, backed by `20260907010000_app_feedback.sql` and reachable
from the profile screen. Three categories — something is broken, an idea,
something else. Until this, the only way to report anything was an email address
at the foot of the privacy policy, which the people most likely to hit a problem
are the least likely to find.
  - RLS routes reports to admins only, never to a priest or servant, so a member
    can say that something is broken — or that they dislike part of an assigned
    canon — without it surfacing in the pastoral relationship. The screen says
    so plainly, and shows exactly what rides along: app version, platform, role,
    and nothing else.
  - A separate periodic survey shipped alongside it (`app/survey.tsx`,
    `lib/survey/schedule.ts`, `20260907020000_feedback_survey.sql`), prompted
    from the dashboard on its own cadence. Both land in `app/admin.tsx`.

**Community feature: streaks and leaderboards for Psalm memorization.**
Done in `20260907030000_psalm_leaderboard.sql` plus `lib/db/leaderboard.ts` and
the UI in `app/(tabs)/psalms.tsx`. Streaks themselves predate this — the state
machine and its once-a-week freeze have been in `lib/psalms/store.ts` all along;
what is new is members seeing each other.
  - Scoped to one servant's class: the smallest circle, and one where the
    members already know each other from Sunday school.
  - Its own consent flag, defaulting to off, never borrowing `vitals_consent` —
    that flag was agreed for one priest, and reading it as agreement to be
    ranked in front of classmates would be a bait-and-switch.
  - Opting in is what buys the view. A member who has not opted in sees no
    board rather than a read-only one; a leaderboard you can lurk on is a
    different, worse feature. A servant sees their class without opting in,
    because they are the teacher and are never ranked in it.
  - Reads go through a `SECURITY DEFINER` RPC that returns a finished board and
    nothing queryable behind it, so the feature grants no new rights over
    another member's profile or progress. Names are cut to "Mina G." — this is
    children's data, and a first name identifies plenty among classmates.

**Add full address to the database (congregant profile/contact).**
Already true when it was queued: `pastoral_contacts` has carried
street / city / state / zip / country since the baseline schema, and
`app/profile.tsx` has collected all of it. What actually shipped on this date
was the *churches* table catching up — `20260907_church_structured_address.sql`
gave parishes the same structured fields instead of one free-text blob, which is
the prerequisite for the distance-sorted picker still queued above. The legacy
free-text column is kept rather than parsed; a hand-entered address does not
split reliably, and a bad guess would silently corrupt a real parish address.
  - Since 2026-09-13 these fields are also dual-written as sealed payloads
    (`20260913020000_encrypt_pastoral_contacts.sql`, phase 1 of 2).

**Make the Canon page more usable, and let every Spiritual Vital be tracked there.**
Done in ba01c0a and e073f8f. The governing rule now holds: anything shown in
Spiritual Vitals can be logged in the Canon.
  - Communion is a first-class service and its own vital, no longer absorbed
    into liturgy — categories match on serviceKeyOf, not a `svc_` prefix.
  - Liturgy is self-loggable with no priest-assigned rule, via the ad-hoc log
    in `lib/canon/attendance.ts`, reachable from the Canon tab's empty state.
  - Confession is scored from the recorded dates against the rule's cadence
    (`confessionVital`), with no interval due until one has fully elapsed. The
    `match: () => false` entry stays — it is how that row opts out of canon-key
    matching, not a stub.
  - The usability pass landed with it: the 7-day backfill strip, "1 of 2 this
    week" labels for counted commitments, and a badge distinguishing a
    priest-assigned item from a self-chosen one.


---

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
