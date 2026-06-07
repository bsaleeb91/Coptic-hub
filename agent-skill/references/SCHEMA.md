# SCHEMA.md — Files, Data Sources, APIs

## Local Files (Current — Commit 1)

| Path | Purpose |
|------|---------|
| `lib/agents.ts` | Agent registry — source of truth for all agents |
| `lib/fixtures.ts` | Fake data for stub phase (replace in each commit) |
| `lib/theme.ts` | Design tokens for non-Tailwind consumers |
| `lib/icons.ts` | Lucide icon name → component map |
| `app/agent/{slug}/` | Per-agent screen stacks |
| `app/(tabs)/` | Hub, Library, Progress, Settings tabs |
| `components/` | Shared UI components |
| `assets/seed/` | JSON seeds (planned): psalms, coptic alphabet, hymns |
| `tailwind.config.js` | NativeWind config — Coptic palette defined here |

---

## Supabase Schema (Commit 1.5)

### `profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | matches `auth.users.id` |
| `role` | enum | `'congregant'` \| `'priest'` \| `'admin'` |
| `school_role` | enum nullable | `'student'` \| `'teacher'` \| null — Sunday School only |
| `class_id` | uuid nullable | FK → Sunday School class (commit 8) |
| `display_name` | text | |
| `created_at` | timestamp | |

A priest who also teaches Sunday School gets `role = 'priest'` and `school_role = 'teacher'`. Not mutually exclusive.

### `agent_progress`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → profiles | |
| `agent_slug` | text | |
| `chunk_id` | text | |
| `mastery_state` | text | |
| `points` | integer | |

### `conversations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `agent_slug` | text | |
| `user_id` | uuid FK → profiles | |
| `created_at` | timestamp | |

### `messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `conversation_id` | uuid FK → conversations | |
| `role` | text | `'user'` \| `'assistant'` |
| `content` | text | |
| `citations` | jsonb | citation blocks from Claude Citations API |

### `sources`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `agent_slug` | text | |
| `title` | text | |
| `status` | text | `'pending'` \| `'ready'` \| `'failed'` |
| `user_id` | uuid FK → profiles | |

### `source_chunks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `source_id` | uuid FK → sources | |
| `content` | text | |
| `page` | integer | |
| `embedding` | vector(1024) | Voyage 3 embeddings, cosine distance |

---

## Confession Pastoral System (Declared in 1.5 — Used in 1.75)

Tables are created with RLS in commit 1.5. App code that writes to them ships in commit 1.75.

### `priest_invite_codes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `priest_id` | uuid FK → profiles | |
| `code` | varchar(6) | unique |
| `used_at` | timestamp nullable | null = valid, non-null = consumed |
| `used_by` | uuid FK → profiles nullable | |
| `created_at` | timestamp | |

Single-use. No time expiry. Priest generates, congregant consumes once.

### `priest_congregant_links`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `priest_id` | uuid FK → profiles | |
| `congregant_id` | uuid FK → profiles | |
| `consented_at` | timestamp | when congregant accepted |
| `revoked_at` | timestamp nullable | null = active |
| `ported_from_priest_id` | uuid nullable | set if congregant switched from another priest |

Constraint: only one active link per congregant (`revoked_at IS NULL`).

### `confession_sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `congregant_id` | uuid FK → profiles | |
| `priest_id` | uuid FK → profiles | priest at time of session |
| `completed_at` | timestamp | |
| `categories_flagged` | text[] | e.g. `['god', 'neighbor']` — never content |

No notes. No checklist items. No free text. Ever.

### `priest_pastoral_notes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `priest_id` | uuid FK → profiles | |
| `congregant_id` | uuid FK → profiles | |
| `note` | text | priest-authored only |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

Priest writes, priest reads. Congregant has zero visibility into this table.

---

## RLS Policies

| Table | Policy |
|-------|--------|
| `profiles` | Users read/write own row; priests can read `display_name` + `id` of linked congregants |
| `priest_invite_codes` | Priests CRUD their own codes; anyone can read a code by value to validate it |
| `priest_congregant_links` | Each party sees only their own links |
| `confession_sessions` | Congregants insert own sessions; priests read sessions for active linked congregants only |
| `priest_pastoral_notes` | Priests CRUD their own notes; congregants cannot read this table at all |
| `agent_progress` | Users read/write own rows only |
| `conversations` | Users read/write own rows only |
| `messages` | Users read/write via conversation ownership |
| `sources` | Users read/write own rows only |
| `source_chunks` | Readable by authenticated users (public reference data) |

---

## Local SQLite (lib/db/sqlite.ts — migration runner)

All tables registered in the migration runner in commit 1.5. Confession tables stay local forever.

| Table | Columns | Syncs? |
|-------|---------|--------|
| `confession_notes` | `category`, `note`, `updated_at` | Never |
| `confession_state` | `phase`, `completed_at` | Never |
| `confession_checklist` | `category`, `item_id`, `checked`, `updated_at` | Never |
| `confession_sessions_local` | `id`, `completed_at`, `categories_flagged`, `synced` | `synced` flag — drains to `confession_sessions` on reconnect |

`confession_sessions_local.synced`: false until the row is successfully written to Supabase. Offline sessions queue here and drain on reconnect via the same pattern as `agent_progress`.

---

## Edge Functions

| Function | Commit | Purpose |
|----------|--------|---------|
| `claude-proxy` | 1.5 skeleton → 2 live | JWT verify → per-agent model routing → Claude API → SSE stream |
| `ingest-source` | 1.5 skeleton → 2 live | Download PDF → chunk → embed via Voyage 3 → insert to `source_chunks` |

No edge functions needed for the pastoral system — all confession sync runs client-side via the Supabase JS client.

---

## What Ships Per Commit

| Commit | Schema work |
|--------|-------------|
| 1.5 | All Supabase tables + RLS + migrations; SQLite migration runner; auth wired; offline sync pattern for `agent_progress` |
| 1.75 | App code writes to confession tables; priest invite + consent flow; sync logic for `confession_sessions_local` |
| 2 | `ingest-source` + `claude-proxy` bodies live; `source_chunks` first rows written |
| 3 | `agent_progress` first real rows (psalm mastery state machine) |
| 8 | `class_id` on profiles activated; Sunday School project + task tables added |

---

## APIs

| API | Purpose | Model / Config |
|-----|---------|----------------|
| Anthropic Claude | Strict RAG + narrative | Sonnet 4.6 for commentary/rites, Haiku 4.5 for drill hints |
| Voyage AI | Embeddings for RAG | `voyage-3`, 1024 dims, cosine distance |
| Supabase | DB, storage, auth, realtime, edge functions | — |

---

## Key Environment Variables (`.env`)

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...  # server-side only, in Supabase secrets
VOYAGE_API_KEY=...     # server-side only, in Supabase secrets
```

API keys are never in the client bundle. All Claude and Voyage calls go through edge functions.
