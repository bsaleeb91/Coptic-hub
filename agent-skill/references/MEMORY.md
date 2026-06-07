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
