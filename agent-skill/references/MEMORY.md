# MEMORY.md — Lessons Learned

This file grows automatically. KYRIE proposes entries at the end of each session. Bishoy commits them.

---

## Format
```
(YYYY-MM-DD) [Domain] Lesson: what was learned or confirmed
```

---

## Entries

(2026-06-06) [Setup] Initial agent installed in Coptic-hub. KYRIE is the Claude Code dev agent for this repo. Bishoy is the sole developer. Agent registry pattern in lib/agents.ts is the source of truth for all agents.

(2026-06-06) [Architecture] Confession Prep is a new 8th agent (slug: confession-prep). All its data must stay in local SQLite — never Supabase. It needs new AgentUIKind 'guide' and new AgentCategory 'spiritual' added to lib/agents.ts type unions.

(2026-06-06) [Setup] hooks.SessionStart and hooks.Stop in .claude/settings.json require the matcher+hooks array format — same as PostToolUse. Direct array of {type, command} objects fails /doctor validation. Fixed this session.

(2026-06-06) [Architecture] Confession Prep is a full pastoral management system, not just a personal prep tool. Two audiences: congregants (prep flow + link to priest) and priests (roster + pastoral notes). This is now "Commit 1.75" in the roadmap.

(2026-06-06) [Privacy] Hard rule confirmed: confession content (notes, checklist items) stays in local SQLite forever. Only category flags and session dates sync to Supabase — and only with explicit congregant consent.

(2026-06-06) [Confession/Design] Priest invite codes are single-use, no time expiry. used_at = null means valid. Consumed on first use by a congregant.

(2026-06-06) [Confession/Design] Congregant can switch Father of Confession. On switch, they choose to port history or start fresh. Priest A's pastoral notes never transfer to Priest B regardless.

(2026-06-06) [Schema] profiles.role is now 'congregant' | 'priest' | 'admin'. Sunday School teacher/student distinction moves to a separate school_role column. See SCHEMA.md for full table definitions.

(2026-06-06) [Roadmap] Commit 1.75 (Confession Prep live + Priest Portal POC) sits between 1.5 (Supabase infra) and 2 (Bible Commentary). Sequence: 1 → 1.5 → 1.75 → 2.

(2026-06-06) [Theology] Category-level data sharing (which of the four examination areas were flagged) needs review by a Coptic priest before 1.75 ships to real users. Treat as a soft blocker on 1.75.

(2026-06-06) [Confession/POC] For the POC demo to a priest: admin approval is manual (flip role directly in Supabase). No approval UI needed for 1.75.

(2026-06-07) [Architecture] Poimen is a standalone React Native/Expo app (not Next.js, not a feature of Coptic Hub). It lives at poimen/ in the same repo. It replaces Confession Prep (agent 8 / Commit 1.75) and goes much deeper — it is the full pastoral care product.

(2026-06-07) [Architecture] Coptic Hub drops Commit 1.75 (Confession Prep) entirely. Poimen owns all pastoral care. Coptic Hub continues with 7 agents. Conceptually every agent could become its own app someday.

(2026-06-07) [Architecture] Poimen is a container with multiple AI sub-agents inside (Confession Prep, Spiritual Canon Companion, Journal Reflection, Prayer Request, Communion Readiness). The outer shell (Dashboard, nav, vitals) has no AI — sub-agents activate per panel.

(2026-06-07) [Architecture] Poimen shares the Coptic Hub Supabase backend (one login, shared profiles/auth). Poimen-specific tables (pastoral_encounters, spiritual_canons, journal_entries etc.) are RLS-isolated. Justification: auth is expensive to duplicate; profiles.role already spans both apps.

(2026-06-07) [Setup] Hooks in .claude/settings.json must use absolute paths, not relative ones. Relative paths break when Claude Code is opened from a subdirectory (e.g. poimen/). Fixed all three hooks (SessionStart, Stop, PostToolUse) to C:\Users\17165\Coptic-hub\scripts\hooks\*.

(2026-06-07) [Design] Poimen design system: navy (#0f1f3d) + gold (#c9a84c), Cormorant Garamond (display) + Lato (body). Distinct from Coptic Hub's incense/parchment palette. Source of truth: poimen/lib/theme.ts.

(2026-06-07) [Schema] spiritual_canons uses congregant_id (not user_id) to reference the member. user_id does not exist on that table. Fixed in 4 places: priest member query, both assign-canon inserts (priest + servant), servant student query, and the migration RLS policy CHECK clause.

(2026-06-07) [PostgreSQL] CREATE POLICY does not support IF NOT EXISTS syntax — throws ERROR 42601. Correct pattern: DROP POLICY IF EXISTS "name" ON table; then CREATE POLICY "name" with no IF NOT EXISTS guard.

(2026-06-07) [Architecture] Servant role confirmed: Sunday School servants get their own portal (/(servant)) with 3 screens — student roster, student detail, assign-canon. Servants can only assign Prayer + Scripture canons (not fasting/service/sacramental). Students self-report completions on the same Canon tab as any congregant. No confession or counseling access for servants.

(2026-06-07) [Architecture] Role-aware dashboard toggle: profile.role === 'priest' shows FOC VIEW → /(priest); profile.role === 'servant' shows STUDENTS → /(servant); congregant sees no toggle. Implemented in poimen/app/(tabs)/index.tsx header.

(2026-06-07) [Architecture] Pastoral notes (priest-private) stored in agent_progress with user_id = priest.id and agent_slug = 'pastoral-notes-{memberId}'. No dedicated table needed. Payload: { text: string, updated_at: string }. Upserted on conflict.

(2026-06-07) [Poimen] To go live with real data: flip DEMO_MODE = false in poimen/lib/config.ts, and manually set role = 'priest' on the priest's profiles row in Supabase Table Editor. No role-assignment UI exists yet — admin sets it directly.

(2026-06-09) [Deployment] Poimen is live at https://poimen-app.vercel.app (permanent Vercel static deploy). `poimen.vercel.app` is taken by an unrelated Korean church app. To redeploy after a code change: `npx expo export --platform web` in `poimen/`, then `vercel . --yes --scope bishoy-saleeb-s-projects --prod` from the `poimen/` directory. The vercel.json in poimen/ sets outputDirectory to dist and handles SPA routing.

(2026-06-09) [Web/Expo] Three changes are required for a clean Expo web build: (1) `supabase.ts` needs a `localStorage` adapter on `Platform.OS === 'web'` since `expo-secure-store` is native-only; (2) `_layout.tsx` must skip the font-load gate and `SplashScreen.hideAsync()` on web or the page hangs; (3) Expo's `app.json` needs `"web": { "bundler": "metro", "output": "static" }`. All three are already in place.

(2026-06-09) [PowerShell] Git commit messages with multi-line bodies must use PowerShell here-strings: `git commit -m @'...'@` with the closing `'@` at column 0. The bash `$(cat <<'EOF'...)` pattern fails in PowerShell with parse errors.

(2026-06-09) [Deployment] Vercel + Expo Router static export requires a vercel.json with a SPA rewrite rule: { "source": "/(.*)", "destination": "/index.html" }. Without it, direct URL access to any route other than "/" returns 404, even though Expo generates per-route HTML files. Place vercel.json in the project root with "outputDirectory": "dist" and deploy with `vercel . --prod`.

(2026-06-09) [Deployment] When running `vercel <path>` pointing at a subdirectory (e.g. "poimen/dist"), Vercel creates a new project named after that directory ("dist"), not the parent. Fix: always deploy from the project root with outputDirectory in vercel.json. Use `vercel alias set <deployment-url> <alias>` to move a .vercel.app alias between projects without redeploying.

(2026-06-09) [Architecture] DEMO_MODE in lib/config.ts was exported but never imported into DemoProvider — the provider always booted at false regardless of the constant. Fixed by importing DEMO_MODE into demo.tsx and passing it as useState's initial value. This is the gate that prevents the auth guard from redirecting web visitors to /sign-in.

(2026-06-11) [Architecture] Poimen now has a backend-agnostic data-access layer at poimen/lib/db/ (domain modules: auth, profiles, pastoral, canons, prayer, progress + an index barrel). Screens and lib/auth.tsx import `* as db from '@/lib/db'` and never touch Supabase. @supabase/supabase-js is imported in exactly ONE file: lib/supabase.ts. To swap backends or add an offline SQLite cache (for the eventual native iOS/Android build), reimplement lib/db/* + lib/supabase.ts — the 13 screens stay untouched.

(2026-06-11) [Architecture] lib/db convention: list/query functions return [] (never null), key-value reads (getAgentProgress) return the payload object or null, and callers build their own upsert rows so exact Supabase row shapes (incl. onConflict and whether top-level updated_at is set) are preserved. Auth is backend-agnostic via AuthUser/AuthSession types defined in lib/db/auth.ts — do not reintroduce Supabase's Session/User into screens.

(2026-06-11) [Git] Poimen's default/base branch on GitHub is `poimen-main`, NOT `main`. PRs must target poimen-main. The repo currently has no CI configured — a "pending" status with 0 checks is GitHub's empty state, not a stuck check.

(2026-06-11) [Tooling] Fresh remote containers clone without node_modules — run `npm install` in poimen/ before `npm run typecheck`. CRITICAL: run typecheck FROM the poimen/ directory; running tsc from the repo root resolves the wrong tsconfig and floods hundreds of false react-native/DOM lib errors.

(2026-06-11) [Bug/Confirmed] Two latent bugs fixed this session, both confirming known schema facts: (1) servant student canon counts always showed 0 because a query selected `user_id` (nonexistent on spiritual_canons) while keying by `congregant_id` — reconfirms spiritual_canons uses congregant_id; (2) profile.church_name was read but absent from the Profile type and getProfile's select — Profile now includes church_name.
