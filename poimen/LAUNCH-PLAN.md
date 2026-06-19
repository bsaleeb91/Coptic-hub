# Poimen — Launch Plan

Work through these in order before Capacitor build and App Store submission.

---

## Phase 1 — Design Decisions (from SECURITY-AND-FIXES-SESSION.md)

- [x] **#5** Confession appointment scheduling — disabled, "Coming Soon" UI. Priest uses separate scheduling app.
- [x] **#7** FOC consent — `foc_consent_at` on profiles. Consent modal on Dashboard. Priest view gated on consent.
- [ ] **#9** Pastoral notes table — move priest notes from `agent_progress` JSON blob to a typed `pastoral_notes (priest_id, member_id, body, created_at)` table. Small migration, cleaner than the current blob.
- [ ] **#12** Vitals consent gate — opt-in prompt on first vitals use. Store as `profiles.vitals_consent` boolean.
- [ ] **#14** Confession self-report — congregant logs their own confession date for communion readiness. Store as `profiles.last_confession_at` (also set by priest when logging a confession encounter).

---

## Phase 2 — QC Pass

Full manual QC of https://poimen-app.vercel.app across all 3 roles:

- [ ] **Congregant** — onboarding, dashboard, vitals, confession prep, canon, prayer, consent modal
- [ ] **Priest** — flock roster, member detail (all tabs), log encounter, assign canon, consent gate
- [ ] **Servant** — student roster, student detail, assign canon (restricted), prayer tab

---

## Phase 3 — Deploy & Build

- [ ] Redeploy to Vercel after Phase 1 + 2 changes (`npx expo export --platform web` → `vercel . --prod` → alias set)
- [ ] Capacitor setup for iOS + Android
- [ ] TestFlight submission
- [ ] Play Store internal track submission

---

## Soft Blockers (must resolve before real parish pilot)

- Theological review of category-level data sharing by a Coptic priest
- FOC consent UX reviewed with at least one priest
- COPPA / GDPR-K review if any users are under 13
