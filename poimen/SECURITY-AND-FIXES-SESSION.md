# Poimen Downstream Issues — Session Notes (June 11, 2026)

## What this document covers
A full record of the issues identified, fixes implemented, schema changes made,
and design decisions reached during this session. Use it to guide the Supabase
migration and any follow-up work.

---

## Issues Found and Fixed

### 1. `private_note` column exposed to congregants (CRITICAL)
**Problem:** The `pastoral_encounters` table had a `private_note` column. The
congregant RLS policy granted full-row SELECT (`auth.uid() = congregant_id`),
which exposed the priest's private notes to the very person they were written
about. A `.select('*')` from the congregant would return the private note.

**Fix:** Moved `private_note` to a new priest-only table:
`pastoral_encounter_private_notes (encounter_id, priest_id, private_note)`.
The congregant's RLS on `pastoral_encounters` can no longer reach this column
because it lives on a different table with a `priest_id = auth.uid()` guard.

`insertEncounter()` now splits the row: inserts the encounter first, gets back
the `id`, then inserts the private note in a second call.

File: `poimen/lib/db/pastoral.ts`

---

### 2. Prayer request content stored free-text (CRITICAL privacy)
**Problem:** Prayer requests stored a `topic text` column containing user-written
text like *"pray for my mom's cancer"* or *"I'm struggling with addiction"*.
This is identifying content that should never sit in a database.

**Fix:** Replaced `topic text` with `category text not null default 'other'`
with a CHECK constraint:
```
check (category in ('health','family','relationships','work','faith','gratitude','appointment','other'))
```
The UI now shows a category chip picker. The specific details of the request
are **never collected** — only the category enum is stored. The priest sees
"this person has a Health request" and nothing more.

Files: `supabase/schema.sql`, `poimen/app/(tabs)/prayer.tsx`,
`poimen/app/(tabs)/confession.tsx`, `poimen/lib/db/prayer.ts`,
`poimen/app/(priest)/member.tsx`, `poimen/app/(servant)/student.tsx`

---

### 3. Servant canon insert restriction was client-side only
**Problem:** Servants (Sunday school teachers) were only restricted from
assigning non-prayer canons in the client UI. A direct API call or a client
modification could bypass it.

**Fix:** Added an `AS RESTRICTIVE` Postgres policy:
```sql
create policy "canons: servant insert restricted" on public.spiritual_canons
  as restrictive
  for insert with check (
    not exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.school_role = 'teacher')
    or component ilike any(array[
      '%agpeya%','%prayer%','%psalm%','%scripture%',
      '%gospel%','%epistle%','%bible%','%reading%',
      '%compline%','%vespers%','%tasbeha%','%praises%'
    ])
  );
```
Restrictive policies must pass in addition to permissive ones — servants
cannot insert canons with components outside this list even via direct API.

File: `supabase/schema.sql`

---

### 4. Role self-promotion not blocked at database level
**Problem:** Any authenticated user could call
`supabase.from('profiles').update({ role: 'priest' })` on their own row
because the `profiles: own row` policy allows all operations including UPDATE.

**Fix:**
```sql
revoke update (role) on public.profiles from authenticated;
```
Role changes now require a privileged server-side function.

File: `supabase/schema.sql`

---

### 5. `canon_completions` unique constraint wrong
**Problem:** The unique constraint was `(canon_id, completed_on)`, meaning
only one user could ever mark a canon complete on a given day. For canons
assigned to multiple congregants this would silently fail for the second user.

**Fix:** Constraint changed to `unique (canon_id, user_id, completed_on)`.
`upsertCanonCompletion` onConflict updated to match.

Files: `supabase/schema.sql`, `poimen/lib/db/canons.ts`

---

### 6. `foc_note` column name mismatch — silent data loss
**Problem:** `log-encounter.tsx` sent `{ foc_note: '...' }` but the column
was named `private_note`. Supabase silently dropped the unknown key, so every
private note typed by a priest was lost without error.

**Fix:** Field renamed to `private_note` to match the schema (and then moved
to the separate table per fix #1).

File: `poimen/app/(priest)/log-encounter.tsx`

---

### 7. Vitals shape mismatch — priest always saw 0%
**Problem:** The congregant saved vitals as a bare array `[3,2,4,1,5]`.
The priest-side code tried to read named keys (`payload.prayer`, etc.) and
got `undefined` for everything, so all vitals showed as 0%.

**Fix:** Both sides now use a shared `VITAL_KEYS` constant:
`['prayer','scripture','liturgy','fasting','service']`. Save encodes to
`{ prayer: 3, scripture: 2, ... }`, load reads the same keys.

File: `poimen/app/(tabs)/index.tsx`

---

### 8. Vitals label 'Small Group' instead of 'Fasting'
**Problem:** The fourth vital was labelled "Small Group" instead of "Fasting"
which is inconsistent with Coptic practice (fasting is a primary spiritual
discipline; small groups are not a standard category).

**Fix:** `VITAL_LABELS[3]` changed from `'Small Group'` to `'Fasting'`.

File: `poimen/app/(tabs)/index.tsx`

---

### 9. Dashboard subtitle was static
**Problem:** The dashboard showed a hardcoded subtitle with no date awareness.

**Fix:** Added `getDashboardSubtitle()` that returns the current Coptic
liturgical context: day of week + date, plus the name of any active fast
(Apostles' Fast, St. Mary's Fast, Advent/Christmas).

File: `poimen/app/(tabs)/index.tsx`

---

### 10. Canon completion % was hardcoded ÷30
**Problem:** `pct = count / 30 * 100` gave wrong percentages for canons
of any duration other than 30 days. A 7-day canon with 7 completions showed
23%, not 100%.

**Fix:** Uses actual `start_date` and `end_date` (or `Date.now()` for active):
```js
const durationDays = Math.max(Math.round((end - start) / 86400000), 1);
pct = Math.min(Math.round((count / durationDays) * 100), 100);
```

File: `poimen/app/(tabs)/canon.tsx`

---

### 11. Confession examination "Family" category replaced with "Omissions"
**Problem:** Standard Coptic confession examination uses four categories:
God, Neighbor, Self, and Omissions. The app had "Family" which is a subset of
Neighbor, not a canonical examination category.

**Fix:** Renamed `Family` tab to `Omissions` with appropriate examination
questions (failure to pray, serve, attend liturgy, fast, etc.).

File: `poimen/app/(tabs)/confession.tsx`

---

### 12. Confession appointment used free-text topic
**Problem:** The appointment request sent `topic: 'Confession appointment request'`
but after the schema change `topic` became `category`.

**Fix:** Changed to `category: 'appointment'`.

File: `poimen/app/(tabs)/confession.tsx`

---

### 13. Priest member notes had no timestamp
**Problem:** The priest's running note log appended new notes without any
timestamp, making it impossible to tell when observations were made.

**Fix:** Each new note is prefixed with `[Jun 11, 2026]` (locale-formatted
current date) before appending to the log.

File: `poimen/app/(priest)/member.tsx`

---

### 14. Prayer visibility: servant access used wrong policy
**Problem:** The servant prayer RLS policy only filtered by `servant_id` but
didn't verify the accessor actually has `school_role = 'teacher'`. Any user
who was somehow linked as a servant could read prayer requests.

**Fix:** Policy now requires both conditions:
```sql
and exists (select 1 from public.profiles s
  where s.id = auth.uid() and s.school_role = 'teacher')
```

File: `supabase/schema.sql`

---

### 15. `match_chunks` RPC accepted `p_user_id` parameter
**Problem:** The RAG retrieval RPC accepted a `p_user_id uuid` parameter that
callers could set to any user's ID to retrieve their embeddings.

**Fix:** Replaced with `auth.uid()` internally — the RPC now always operates
on the authenticated user's chunks.

File: `supabase/schema.sql`

---

### 16. Dead reflection/share UI in canon.tsx
**Problem:** `SwipeableComponent` had a REFLECTION TextInput that never saved
its content, and a "Share with FOC" checkbox that triggered no action. Both
were misleading dead UI that could confuse users into thinking their reflection
was being saved or sent.

**Fix:** Removed the `note`/`shared` state, `expanded` prop, `toggleExpand`
handler, the entire expanded panel JSX, and all associated dead styles.
`TextInput` removed from imports.

File: `poimen/app/(tabs)/canon.tsx`

---

## Prayer Request Privacy — How it Works Now

| What | Where stored | Who can see it |
|------|-------------|----------------|
| Category (`work`, `faith`, `health`, etc.) | Supabase `prayer_requests` | You + your set visibility (FOC / servant) |
| Specific details ("pray for my job situation") | **Nowhere** — never collected | Nobody |

The category is the only data point. The priest sees *"this person has a Work
prayer request"* and nothing more. The details stay in the user's head.

### Visibility options
| Option | Who sees it |
|--------|-------------|
| `private` | Only you |
| `foc_only` | You + your Father of Confession |
| `foc_and_servant` | You + FOC + Sunday school servant |
| `servant_only` | You + Sunday school servant |

### If you want free-text that the priest CAN read
Client-side encryption is the path:
- User generates an X25519 keypair on first launch, stored in `expo-secure-store`
- Public key stored in `profiles`
- User encrypts text with priest's public key using `tweetnacl`
- Ciphertext stored in Supabase — unreadable by anyone else
- Priest decrypts with their private key
- Requires key exchange: priest must have a registered public key before
  sharing is possible
This was not implemented — it's an architecture decision for a future sprint.

---

## Supabase Migrations Required (Manual)

These schema changes cannot be applied automatically. Run them in the
Supabase Dashboard → SQL Editor.

### Migration 1: Separate private notes table
```sql
-- Create new table
create table if not exists public.pastoral_encounter_private_notes (
  id            uuid primary key default gen_random_uuid(),
  encounter_id  uuid not null references public.pastoral_encounters(id) on delete cascade,
  priest_id     uuid not null references public.profiles(id) on delete cascade,
  private_note  text not null,
  created_at    timestamptz not null default now()
);
alter table public.pastoral_encounter_private_notes enable row level security;
create policy "encounter_private_notes: priest owns"
  on public.pastoral_encounter_private_notes
  for all using (auth.uid() = priest_id);

-- Migrate existing data (if any private notes exist)
insert into public.pastoral_encounter_private_notes (encounter_id, priest_id, private_note)
select id, priest_id, private_note
from public.pastoral_encounters
where private_note is not null and private_note <> '';

-- Drop the column
alter table public.pastoral_encounters drop column if exists private_note;
```

### Migration 2: Fix canon_completions unique constraint
```sql
alter table public.canon_completions drop constraint if exists canon_completions_canon_id_completed_on_key;
alter table public.canon_completions add constraint canon_completions_canon_id_user_id_completed_on_key
  unique (canon_id, user_id, completed_on);
```

### Migration 3: prayer_requests topic → category
```sql
alter table public.prayer_requests rename column topic to category;
alter table public.prayer_requests alter column category set not null;
alter table public.prayer_requests alter column category set default 'other';
alter table public.prayer_requests add constraint prayer_requests_category_check
  check (category in ('health','family','relationships','work','faith','gratitude','appointment','other'));
-- Nullify any existing values that don't match (or set to 'other')
update public.prayer_requests set category = 'other'
  where category not in ('health','family','relationships','work','faith','gratitude','appointment','other');
```

### Migration 4: Block role self-promotion
```sql
revoke update (role) on public.profiles from authenticated;
```

### Migration 5: Add servant_id to profiles
```sql
alter table public.profiles
  add column if not exists servant_id uuid references public.profiles(id) on delete set null;
```

### Migration 6: Restrictive servant canon policy
```sql
create policy "canons: servant insert restricted" on public.spiritual_canons
  as restrictive
  for insert with check (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.school_role = 'teacher'
    )
    or component ilike any(array[
      '%agpeya%','%prayer%','%psalm%','%scripture%',
      '%gospel%','%epistle%','%bible%','%reading%',
      '%compline%','%vespers%','%tasbeha%','%praises%'
    ])
  );
```

### Migration 7: Fix match_chunks RPC
```sql
create or replace function public.match_chunks(
  query_embedding extensions.vector(1024),
  match_threshold float,
  match_count     int,
  p_agent_slug    text
)
returns table (id uuid, content text, page int, source_id uuid, similarity float)
language sql stable as $$
  select
    sc.id, sc.content, sc.page, sc.source_id,
    1 - (sc.embedding <=> query_embedding) as similarity
  from public.source_chunks sc
  join public.sources s on s.id = sc.source_id
  where s.user_id = auth.uid()
    and s.agent_slug = p_agent_slug
    and s.status = 'ready'
    and 1 - (sc.embedding <=> query_embedding) > match_threshold
  order by sc.embedding <=> query_embedding
  limit match_count;
$$;
```

---

## Design Decisions — Pending (Not Code-Ready)

These require product decisions before implementation:

| # | Topic | Decision needed |
|---|-------|----------------|
| 5 | Confession appointment inbox | Does the priest need a dedicated inbox, or is a prayer request category sufficient? |
| 7 | FOC consent table | Should congregants explicitly consent before a priest can view their data? |
| 9 | Pastoral notes dedicated table | Move priest notes from `agent_progress` JSON blob to a typed `pastoral_notes` table? |
| 12 | Vitals consent gate | Should vitals be opt-in, with a consent screen before any data is shared? |
| 14 | Confession self-report | Should congregants be able to log their own confession date for communion readiness tracking? |
| E | Client-side encryption | Implement tweetnacl + X25519 for free-text prayer content that priests can read? |

---

## Files Changed This Session

```
supabase/schema.sql
poimen/app/(tabs)/index.tsx
poimen/app/(tabs)/canon.tsx
poimen/app/(tabs)/prayer.tsx
poimen/app/(tabs)/confession.tsx
poimen/app/(priest)/log-encounter.tsx
poimen/app/(priest)/member.tsx
poimen/app/(servant)/student.tsx
poimen/lib/db/pastoral.ts
poimen/lib/db/prayer.ts
poimen/lib/db/canons.ts
```

Branch: `claude/poimen-downstream-issues-x2m94f`
