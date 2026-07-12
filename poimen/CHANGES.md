# Poimen — Change Log
Session: 2026-06-18

---

## Database (Supabase SQL)

### `20260618_security_fixes.sql`
Single migration that covers all schema and security fixes. Safe to re-run (all IF EXISTS / IF NOT EXISTS).

| # | Change | Why |
|---|--------|-----|
| 1 | Created `public.get_my_role()` — SECURITY DEFINER function that returns the calling user's role | Any policy on `profiles` that directly queries `profiles` causes infinite RLS recursion. A security definer function bypasses RLS on the inner query, breaking the cycle. |
| 2 | Dropped and recreated `"Users update own profile"` UPDATE policy with `WITH CHECK (role = get_my_role())` | Original policy had no WITH CHECK, letting any authenticated user escalate their own role to 'priest' via a direct Supabase client call. |
| 3 | `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS foc_consent_at timestamptz` | `getProfile()` selects this column. Without it, every profile fetch returns a 500 and sign-in silently fails. |
| 4 | `CREATE TABLE IF NOT EXISTS` for `pastoral_contacts`, `pastoral_profile`, `pastoral_children` | The second migration (`20260608_pastoral_contact_lifestage.sql`) was never applied to the live database. These tables didn't exist in production. |
| 5 | Recreated FOC read policies on all three pastoral tables using `profiles.foc_id` | Original migration referenced `priest_congregant_links` which was never created. Policies were broken from day one. |
| 6 | Added `"FOC reads flock vitals"` SELECT policy on `agent_progress` | Priests were silently blocked from reading congregant vitals despite the app's copy saying vitals are shared with the FOC. |
| 7 | Dropped ALL profiles policies and recreated without self-references | The `"profiles: priest sees flock"` policy contained a subquery on `profiles` inside a SELECT policy on `profiles` — infinite recursion on every profile fetch, breaking sign-in. |
| 8 | `REVOKE UPDATE (role) ON profiles FROM authenticated` | Column-level privilege blocks any authenticated user from changing their own role, replacing the WITH CHECK approach which caused recursion. |

### Ad-hoc SQL (run in SQL editor, not in a migration file)
- `NOTIFY pgrst, 'reload schema'` — reloaded PostgREST schema cache after adding `foc_consent_at`. Supabase removed the dashboard button; this is the equivalent command.
- Password reset for test accounts:
  ```sql
  UPDATE auth.users
  SET encrypted_password = crypt('Poimen@Test123!', gen_salt('bf'))
  WHERE email IN ('test-congregant@poimen.test', 'test-priest@poimen.test', 'test-servant@poimen.test');
  ```

---

## Code Changes

### `lib/config.ts`
- `DEMO_MODE` changed from `true` → `false`
- **Why:** New real users were defaulting to demo mode and seeing fake data.

### `app/(tabs)/confession.tsx`
- Replaced the "REQUEST APPOINTMENT WITH FOC" button with a static "Coming Soon" card.
- **Why:** The button submitted a prayer request with `category = 'appointment'`, which violates the `prayer_requests` CHECK constraint. The insert silently failed every time. Scheduling is deferred to a future update.

### `app/_layout.tsx`
- Added `View` to imports.
- Changed `if (loading && !demoMode) return null` → `return <View style={{ flex: 1, backgroundColor: '#0f1f3d' }} />`
- **Why:** Expo's static export pre-renders the layout with `loading = true`, which produces empty HTML. The client then tries to hydrate and render the sign-in screen over that empty HTML — React Error #418 (hydration mismatch). Event handlers never attach, so all buttons are dead. Returning a solid navy view keeps server and client in sync during the loading state.

### `app/sign-in.tsx`
- Added `router.replace('/(tabs)')` after successful sign-in.
- **Why:** `RootLayoutNav` uses `useSegments()` to detect when the user is on the sign-in page and redirect after auth. On the Vercel static export, the segment check wasn't firing reliably after the auth state change. The sign-in screen now handles its own redirect.

### `app/(tabs)/prayer.tsx`
- Added `chipLabel` field to `VISIBILITY_OPTS` (separate from the full `label`).
- Removed the fragile string-splitting logic from chip render: `opt.label.split(' — ')[0].split(' only')[0].split(' + ')[0]`
- Replaced with `{opt.chipLabel}` directly.
- **Why:** The original split logic stripped everything after ` + `, so "Father of Confession + Servant" always rendered as "Father of Confession" — identical to the FOC-only chip. Two buttons looked the same.
- Chip labels: `Private` · `Father of Confession` · `FOC + Servant` · `Servant only`
- Full descriptions in `VIS_DISPLAY` still spell out the complete meaning below the chips when selected.

### `app/profile.tsx`
- Added `Platform` to imports.
- Wrapped `handleSignOut` to use `Platform.OS === 'web'` check: on web, calls `signOut()` directly then `router.replace('/sign-in')`; on native, keeps the `Alert.alert` confirmation dialog.
- **Why:** `Alert.alert` on Expo web relies on `window.confirm`, which can be blocked or ignored by browsers. The sign-out button appeared to do nothing on the web deployment.

---

## Test Accounts (Supabase — live)

| Email | Role | Password |
|-------|------|----------|
| test-congregant@poimen.test | congregant | Poimen@Test123! |
| test-priest@poimen.test | priest | Poimen@Test123! |
| test-servant@poimen.test | servant | Poimen@Test123! |

Congregant's `foc_id` is set to the priest's UUID. All accounts were manually confirmed (email confirmation bypassed).

---

## Known Open Items
See `QA-FIXES.md` for the full prioritized list (synced to code 2026-07-12). Summary of what remains:

**HIGH**
- Priest has no notification when a congregant requests an appointment
- Route protection is client-side only (RLS is the real enforcement layer — accepted risk)

**MEDIUM**
- Session tokens in localStorage on web (accepted risk — no server layer for httpOnly cookies on static export)
- `any` types remain in several `lib/db/*.ts` modules; no generated Supabase types yet
- Error-return handling from `lib/db/*` writes needs a pass to confirm every screen surfaces failures

**Product decisions pending**
- FOC linking flow: priest invites congregant, or congregant searches for priest?
- Role request flow: in-app or dashboard only?
