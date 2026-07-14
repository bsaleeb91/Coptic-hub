# Coptic Hub

A single mobile home for multiple Coptic Orthodox AI agents — Bible Commentary, Sermon Digest, Psalm Memorization, Coptic Language, Hymn Memorization, Rites & Traditions, and Sunday School Projects.

## Status: commit 1 — shell mockup

This is the on-device mockup. All 7 agents are stubbed with hardcoded sample data so you can feel the layout, color, and nav on a real phone before any backend work. There is **no** Supabase, **no** real auth, and **no** live LLM calls in this commit.

See `/root/.claude/plans/sleepy-forging-mist.md` for the full plan and roadmap (commits 1.5, 2, 3, and beyond).

## Run it

```bash
nvm use           # Node 20
npm install
npx expo start
```

Then either:
- Scan the QR in the terminal with the **Expo Go** app on your phone (recommended — real device feel)
- Press `i` for iOS Simulator (requires Xcode)
- Press `a` for Android Emulator (requires Android Studio)
- Press `w` for a web build

## What works in this commit

- Onboarding carousel introducing all 7 agents
- Hub home with agent cards grouped by category (Study / Memorization / Reference / Planning)
- Themed stack headers per agent
- Tabs: Hub, Library, Progress, Settings
- Bible Commentary: fake grounded chat with clickable citation chips and a refusal example
- Psalm Memorization: dashboard, progress (8 NKJV psalms per SPEC.md), leaderboard, 4-mode drill screen
- Coptic Language: fake alphabet grid + drill
- Hymn Memorization: fake hymn list + drill
- Rites & Traditions: fake grounded chat
- Sermon Digest: fake summary card
- Sunday School: fake project planner

## What's fake / coming later

| Area | Current | Later |
|---|---|---|
| Auth | "Sign in" button just navigates to tabs | Supabase magic link + password (commit 1.5) |
| Data | Hardcoded in `lib/fixtures.ts` | Real Supabase + SQLite offline cache (commit 1.5) |
| Bible Commentary | Fake chat bubbles with fake citations | Real pgvector RAG + Claude Citations (commit 2) |
| Psalm drills | Visual only, no scoring | Real mastery tracking, Claude Haiku feedback (commit 3) |

## File layout

```
app/             Expo Router screens
  (auth)/        Sign-in, onboarding
  (tabs)/        Hub home, Library, Progress, Settings
  agent/         Per-agent stacks
lib/             Agent registry, theme, fixtures
components/      Shared UI: AgentCard, ChatView, CitationChip, DrillCard, etc.
```

The **agent registry** at `lib/agents.ts` is the single source of truth. Adding a new agent = one entry there + one folder under `app/agent/`.
