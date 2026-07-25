# Archived migrations (superseded, reconciled 2026-07-22)

These are pre-baseline migration files that were carried over from before Poimen's
schema was squashed. **They do not describe the live database** and must not be
replayed. They are kept only as a historical record of intent.

## What happened

Poimen's own migration history diverged from production (RLS was rewritten by hand in
the Supabase dashboard) and was squashed into a single verified baseline on 2026-07-13
— see the fuller account in `Coptic-hub/poimen/supabase/migrations_archive/README.md`
(same repo family, main Poimen branch). This merge branch (`Poimen-nepsis-merge`) still
had the old, pre-squash migration files sitting alongside genuinely new ones written
after the baseline. On 2026-07-22 those two were reconciled:

- The 18 files in this folder predate the 2026-07-13 baseline and are fully superseded
  by it (confirmed for at least one, `002_servant_role.sql` from the repo's now-archived
  top-level `supabase/` folder — its `servant_id` column/policies exist verbatim in the
  baseline).
- 6 files were genuinely new and had never been applied to production. They were
  applied via `supabase db push` on 2026-07-22 and now live in the parent
  `migrations/` folder alongside the baseline: `20260717_assigned_canon_categories.sql`,
  `20260719010000_foc_reads_confession_dates.sql`,
  `20260719030000_foc_reads_personal_rule.sql`,
  `20260719040000_member_reads_own_encounters.sql`,
  `20260719050000_signup_role_selection.sql`, `20260720_foc_reads_visit_requests.sql`.
  (Three of these were renamed from a bare-date prefix to a full timestamp to avoid a
  version collision in Supabase's migration tracking — the remote history table was
  repaired via `supabase migration repair` to match, no SQL was re-run.)

## What's authoritative instead

`poimen/supabase/migrations/` — matches production exactly as of 2026-07-22 (verified
via `supabase migration list`, all versions showing local == remote).
