# Archived migrations (superseded 2026-07-13)

These are the original migration files. **They do not describe the live database** and
must not be replayed. They are kept only as a historical record of intent.

## What happened

At some point the RLS layer was rewritten by hand in the Supabase dashboard rather than
through the CLI, and the migration files were never updated to match. By July 2026 the two
had diverged badly:

- ~20 policies existed in production that appeared in **no** migration file
  (e.g. `canons: priest owns`, `canons: servant insert restricted`, `priest sees flock`).
- ~23 policies that these files create had been **dropped** from production and replaced
  with differently-named equivalents (e.g. old `Priest/servant writes canons`
  → live `canons: priest owns`).
- The remote migration history table had no record of any of them, so `supabase db push`
  would have tried to replay all 16 from scratch against a database that already had them.

## Resolution

The schema was squashed to a single baseline generated from the live database:

    supabase/migrations/20260713010000_baseline_remote_schema.sql

That baseline was verified against production with `supabase db diff --linked` (empty diff),
and the migration history table was repaired so local and remote now agree. New migrations
build on top of the baseline.

## Two things worth knowing

- The baseline includes tables Poimen does not own (`conversations`, `messages`, `sources`,
  `source_chunks`, and the `match_chunks` function). This Supabase project is **shared** with
  the Coptic-hub main app.
- `supabase db dump` only emits the `public` schema, so it silently omits the
  `on_auth_user_created` trigger on `auth.users`. That trigger is appended manually at the end
  of the baseline. If you ever regenerate the baseline, **re-add it** — without it, signup
  creates an auth user with no `profiles` row and the app breaks on first load.
