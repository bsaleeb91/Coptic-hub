# Nepsis — Launch Plan

Work through these in order before Capacitor build and App Store submission.

---

## Phase 1 — Design Decisions (from SECURITY-AND-FIXES-SESSION.md)

- [x] **#5** Confession appointment scheduling — disabled, "Coming Soon" UI. Priest uses separate scheduling app.
- [x] **#7** FOC consent — `foc_consent_at` on profiles. Consent modal on Dashboard. Priest view gated on consent.
- [x] **#9** Pastoral notes table — `pastoral_notes (author_id, member_id, body, created_at, updated_at)`. Covers both priest and servant notes. Edit + delete per note. Migration backfills existing blobs from agent_progress.
- [x] **#12** Vitals consent gate — `profiles.vitals_consent boolean`. Dashboard: auto-show modal when `foc_id` set + `vitals_consent = null` (gold "SHARE WITH MY FOC" + muted skip link). Nudge banner when `vitals_consent = false`. Profile: toggle under FOC section. RLS policy updated to require `vitals_consent = true`.
- [x] **#14** Confession self-report — `profiles.last_confession_at`. Dashboard tile shows real days (null → "—"). Priest auto-stamps on confession encounter log. Congregant self-reports via Confession tab "Log My Last Confession" card. CTA banner activates on due/overdue status.

---

## Phase 2 — QC Pass

Full manual QC of https://poimen-app.vercel.app across all 3 roles:

- [x] **Congregant** — onboarding, dashboard, vitals, confession prep, canon, prayer, consent modal
- [x] **Priest** — flock roster, member detail (all tabs), log encounter, assign canon, consent gate
- [x] **Servant** — student roster, student detail, assign canon (restricted), prayer tab

---

## Phase 3 — Deploy & Build

- [ ] Redeploy to Vercel after Phase 1 + 2 changes (`npx expo export --platform web` → `vercel . --prod` → alias set)
- [ ] Capacitor setup for iOS + Android
- [ ] TestFlight submission
- [ ] Play Store internal track submission

---

## Backlog (post-launch features)

- [ ] **Visitation scheduling** — priest/servant schedules home or outside-home visits with congregants; time, location type (home / other), notes

---

## Soft Blockers (must resolve before real parish pilot)

- Theological review of category-level data sharing by a Coptic priest
- FOC consent UX reviewed with at least one priest
- COPPA / GDPR-K review if any users are under 13
