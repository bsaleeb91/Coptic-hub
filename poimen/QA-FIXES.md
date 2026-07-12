# Poimen QA Fix List
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

- [x] **`follow_up_date` column missing from schema** — Fixed in `20260618_encounter_followup.sql`; `app/(priest)/log-encounter.tsx` now sends and persists it.

- [x] **Date input not validated** — Fixed: `log-encounter.tsx` parses with `new Date()`, checks `isNaN(parsedDate.getTime())`, and shows `dateError` before saving.

- [x] **`DEMO_MODE = true` hardcoded** — `lib/config.ts` line 3 is `false`.

- [x] **No UI for congregant to set their Father of Confession** — `app/link-to-foc.tsx` exists.

- [ ] **Priest has no notification when appointment is requested** — Still no badge/unread indicator found anywhere in `app/(priest)/*.tsx`. Genuinely open.

- [x] **Admin screen has no role check** — Fixed: `app/admin.tsx` lines 72 & 96 gate on `profile.role !== 'admin'`.

- [ ] **All route protection is client-side only** — Still true; no `middleware.ts` in the repo. Accepted as documented risk (RLS is the real enforcement layer) rather than fixed — see MEDIUM below.

---

## 🟡 MEDIUM — Edge Cases & Silent Bad Behavior

- [x] **No consent flow before FOC sees congregant data** — Fixed in `20260620_foc_consent_gate.sql`: all FOC-read RLS policies now require `foc_consent_at IS NOT NULL`.

- [ ] **Session tokens in localStorage on web** — Still true (`lib/supabase.ts` web `StorageAdapter` uses `localStorage`). **Accepted risk**: Expo static export has no server layer for httpOnly cookies. Same posture as the client-side route protection item above — RLS is the actual security boundary, not the client storage mechanism.

- [x] **Pastoral encounter records cascade-delete when priest is deleted** — Fixed in `20260623_restrict_priest_delete.sql`: FK changed to `on delete restrict`.

- [x] **No foreground/resume lifecycle handling** — Fixed: `app/_layout.tsx` lines 140–149 has an `AppState` listener calling `startAutoRefresh()`/`stopAutoRefresh()`.

- [~] **Pervasive silent error swallowing** — Partially fixed. `lib/db/pastoral.ts`, `canons.ts`, `prayer.ts` etc. return `{ error }` from writes. Still needs a pass to confirm every calling screen surfaces failures instead of assuming success.

- [~] **Pervasive `any` types** — Partially open. 11 remaining `any`/`Record<string, any>` occurrences across `lib/db/*.ts`. No generated Supabase types file exists yet.

---

## 🟢 LOW — Polish & Post-MVP

- [x] **No `.env.example` file** — `poimen/.env.example` exists.
- [ ] **Servant uses `priest_id` column for canon assignment** — Still unfixed naming.
- [ ] **No assignment history** — Still open; `foc_id` remains current-state only.
- [ ] **No Supabase Realtime** — Still open; no `.channel(` usage found anywhere.
- [x] **No app-level encryption on pastoral notes** — Fixed: `lib/crypto.ts` (`encryptNote`/`decryptNote`) is wired into `lib/db/pastoral.ts` for both notes and encounters, and prayer request bodies are encrypted too.

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
Last synced to code: 2026-07-12
Critical fixed: 5 / 5 ✅
High fixed: 5 / 7 (open: priest appointment notification, server-side route protection)
Medium fixed: 4 / 6 (accepted risk: localStorage tokens; partial: error swallowing, `any` types)
Low fixed: 2 / 5 (open: servant `priest_id` naming, assignment history, Realtime)
