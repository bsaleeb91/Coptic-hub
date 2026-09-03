# Archived: stale top-level `supabase/` directory (2026-07-22)

This directory (originally at the repo root as `supabase/`) is **not the source of
truth** for this app's database and must not be applied to any environment.

## What it was

A top-level `supabase/schema.sql` (333 lines, "Coptic Hub + Poimen — Shared Supabase
Schema") plus a single migration file, `supabase/migrations/002_servant_role.sql`
(numbering starts at 002 — no `001_*` file was ever tracked here).

## Why it's archived

- `schema.sql` is an incomplete snapshot: it's missing most of Poimen's tables
  (`pastoral_contacts`, `pastoral_profile`, `pastoral_children`, `churches`,
  `pastoral_notes`, `priest_invite_codes`, `priest_congregant_links`,
  `confession_sessions`, several admin RPCs, etc.) that are documented in Poimen's own
  migration history and reference docs.
- `002_servant_role.sql`'s changes (the `servant_id` column, its FK/index/constraint,
  and the servant-facing RLS policies) are **already present** in production — verified
  against `poimen/supabase/migrations/20260713010000_baseline_remote_schema.sql`, which
  was itself squashed from and confirmed against the live database (see
  `poimen/supabase/migrations_archive/README.md` for that history).

## What's authoritative instead

`poimen/supabase/migrations/` — reconciled on 2026-07-22 to match what's actually live
on the shared Supabase project (ref `lbthbrojolvmxyobsmao`): Poimen's verified baseline
plus every migration since, including the six that originated on this merge branch
(`20260717_assigned_canon_categories.sql` through `20260720_foc_reads_visit_requests.sql`).
Those six were confirmed applied to production via `supabase migration list` on
2026-07-22. Use that directory for all future schema changes.
