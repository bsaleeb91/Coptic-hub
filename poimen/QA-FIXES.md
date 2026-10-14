# Nepsis QA Fix List
Generated from full QA audit — June 18, 2026.
Work through in order: security fixes first, then features, then polish.

---

## 🔴 CRITICAL — Fix Before Any Real User Touches This

- [x] **Role self-escalation** — Fixed in `20260618_security_fixes.sql`: dropped old policy, recreated with `WITH CHECK (role = current DB role)`.
- [x] **`priest_congregant_links` table missing** — Fixed in `20260618_security_fixes.sql`: all 3 FOC read policies rewritten to use `profiles.foc_id`.
- [x] **`foc_consent_at` missing from schema** — Fixed in `20260618_security_fixes.sql`: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS foc_consent_at timestamptz`.
- [x] **Confession appointment request silently fails** — Fixed in `app/(tabs)/confession.tsx`: replaced active button with "Coming Soon" UI (matches LAUNCH-PLAN #5).
- [x] **Priest has no RLS policy to read congregant vitals** — Fixed in `20260618_security_fixes.sql`: added `"FOC reads flock vitals"` policy on `agent_progress`.

---

## 🟠 HIGH — Fix Before First Real Users

- [ ] **`follow_up_date` column missing from schema** — Log Encounter screen sends this field; it's silently ignored. The "Will appear as a reminder" copy is a lie. Add column or remove the input.
  - File: `supabase/migrations/20260608_core_schema.sql` + `app/(priest)/log-encounter.tsx` line 89

- [ ] **Date input not validated** — Encounter date is free text. `new Date(badInput).toISOString()` throws and silently loses the log. Add a date parse check before saving.
  - File: `app/(priest)/log-encounter.tsx` line 85

- [ ] **`DEMO_MODE = true` hardcoded** — New real users default to demo mode and see fake data. Change to `false`.
  - File: `lib/config.ts` line 3

- [ ] **No UI for congregant to set their Father of Confession** — The entire FOC relationship (the core of the app) can't be established from any screen. `foc_id` must be set via the database directly. Build a FOC linking flow.
  - File: New screen needed (e.g., `app/(tabs)/profile.tsx` or a dedicated screen)

- [ ] **Priest has no notification when appointment is requested** — Even after fixing the constraint bug above, the priest only sees the request if they happen to open the member's prayer tab. Add a badge or unread indicator on the flock view.

- [ ] **Admin screen has no role check** — Any authenticated user can navigate to `/admin`. Add an explicit role guard.
  - File: `app/admin.tsx` line 29

- [ ] **All route protection is client-side only** — On the Vercel web deployment, routes can be accessed before JS redirects fire. Consider `middleware.ts` for server-side protection, or document that Supabase RLS is the only enforcement layer.

---

## 🟡 MEDIUM — Edge Cases & Silent Bad Behavior

- [ ] **No consent flow before FOC sees congregant data** — `setFocConsent()` exists but is never called. Data becomes visible to FOC the moment `foc_id` is set, without explicit consent. Wire up the consent step and gate FOC RLS policies on `foc_consent_at IS NOT NULL`.
  - File: `lib/db/profiles.ts` (`setFocConsent` unused)

- [ ] **Session tokens in localStorage on web** — Supabase session stored in localStorage for the Vercel deployment. Vulnerable to XSS. Use httpOnly cookies or document the accepted risk.
  - File: `lib/supabase.ts` lines 15–19

- [ ] **Pastoral encounter records cascade-delete when priest is deleted** — A priest leaving the church deletes all confession history for their congregants. Change `on delete cascade` to `on delete restrict` on `priest_id` in `pastoral_encounters`.
  - File: `supabase/migrations/20260608_core_schema.sql` line 58

- [ ] **No foreground/resume lifecycle handling** — App doesn't check session validity when returning from background. On iOS this will cause stale/expired session hangs.
  - File: `app/_layout.tsx` (add AppState listener)

- [ ] **Pervasive silent error swallowing** — All Supabase calls ignore the `error` return. Add structured logging at minimum; surface errors on user-facing write operations (save encounter, save canon, etc.).
  - Files: All `lib/db/*.ts`

- [ ] **Pervasive `any` types** — Run `supabase gen types typescript` and replace `any` across all db modules.
  - Files: `lib/db/pastoral.ts`, `lib/db/canons.ts`, `lib/db/progress.ts`, `lib/db/prayer.ts`

---

## 🟢 LOW — Polish & Post-MVP

- [ ] **No `.env.example` file** — Document required env vars.
- [ ] **Servant uses `priest_id` column for canon assignment** — Confusing naming. Consider `assigned_by_id` + `assigned_by_role`.
- [ ] **No assignment history** — `foc_id` is a current-state pointer only; no record of previous priests.
- [ ] **No Supabase Realtime** — All data is point-in-time. No live updates between priest and congregant.
- [ ] **No app-level encryption on pastoral notes** — Supabase disk encryption exists but notes are readable by anyone with DB access. Flag for post-MVP.
  - **🔖 FOR KERO:** Should we implement app-level encryption before launch? Tradeoffs: breaks search/filtering, requires key management, data is unrecoverable if key is lost. Current posture: TLS + at-rest encryption + RLS. Is that sufficient for our launch audience?

---

## Needs Product Decision

- **FOC linking flow** — Does the priest invite the congregant (code/QR), or does the congregant search for their priest by name? Needs UX decision before building.
- **Role request flow** — Can users request priest/servant status in-app, or is it always admin-assigned via Supabase dashboard?
- **Priest deletion policy** — If a priest leaves, are encounter records transferred, anonymized, or deleted?
- **Vitals visibility consent** — Should congregants be able to share vitals selectively (e.g., share prayer, hide fasting)?
- **Servant canon authorization** — Should a priest have to approve which canons a servant can assign?

---

## Progress

Started: 2026-06-18
Critical fixed: 5 / 5 ✅
High fixed: 0 / 7
Medium fixed: 0 / 6
Low fixed: 0 / 4
