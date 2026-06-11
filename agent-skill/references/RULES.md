# RULES.md — Coding Rules, Theology Rules, Privacy Rules

## Universal Rules
- NativeWind classes only — no `StyleSheet.create`, no `style={{ ... }}` inline props
- TypeScript strict — no `any`, no `as unknown as X` hacks
- Expo Go compatible — no native modules requiring a custom dev client unless explicitly staged for Commit 1.5+
- Follow the agent registry pattern — every agent = `lib/agents.ts` entry + `app/agent/{slug}/` folder
- Never fabricate theology — cite scripture (Book Chapter:Verse) or name the Church Father

## Theology Rules
- **Scripture citations:** always `Book Chapter:Verse` format (e.g., `John 3:16`)
- **Church Fathers:** always attribute by name + century (e.g., "St. Athanasius, 4th century")
- **Coptic-specific claims:** if uncertain whether a practice is universal Orthodox or specifically Coptic — say so and flag for clerical review
- **Examination of conscience:** the categories in DOMAIN.md are the canonical categories; do not invent new sin categories for the confession agent
- **Sacrament of Repentance:** never describe confession as merely a "journaling" or "self-reflection" exercise — it is a sacrament administered by an ordained priest; the app prepares the user, it does not replace the priest

## Privacy Rules
- **Confession Prep agent:** all notes, checklist state, and personal reflections are stored in local SQLite only
- The confession agent has `offline: { registry: true, content: true, query: true }` — fully offline
- The confession agent must display a privacy notice on first open: "This app never sends your personal reflections to any server"
- Supabase is NEVER called from within the confession-prep agent folder

## Coding Rules

### Agent Registry
```
// Adding a new agent — always ask Bishoy to confirm before writing to agents.ts
export const AGENTS: Agent[] = [
  ...existing,
  {
    slug: 'new-agent',           // must match app/agent/new-agent/ folder
    name: 'Display Name',
    ...
  }
];
```

### Styling
```tsx
// ✅ Always NativeWind
<View className="bg-nile-800 px-4 py-2">
  <Text className="text-parchment-50 text-base">...</Text>
</View>

// ❌ Never
<View style={{ backgroundColor: '#0C2E36', paddingHorizontal: 16 }}>
```

### Screen patterns
- Every agent folder starts with `index.tsx` as the main screen
- Use the closest existing agent folder as a structural template
- Headers use `bg-nile-{shade}` with `text-parchment-50`
- Accent elements use `bg-incense-{shade}`
- Success/mastery states use `bg-olive-{shade}`
- Error/refusal states use `bg-ember-{shade}`

### Stub vs Live
- During stub phase: data comes from `lib/fixtures.ts`
- During live phase: data comes from Supabase or local SQLite
- Do not mix stub data with live API calls in the same screen

### Poimen data access (as of 2026-06-11)
- All Supabase access in Poimen goes through the data-access layer at
  `poimen/lib/db/`. Screens import `* as db from '@/lib/db'`.
- **Never** import `@supabase/supabase-js` or `@/lib/supabase` into a screen or
  any file other than `lib/supabase.ts`. New queries go in the relevant
  `lib/db/*` module, not inline in a screen.
- Use the backend-agnostic `AuthUser` / `AuthSession` types from `lib/db/auth.ts`
  — do not reintroduce Supabase's `Session` / `User` into app code.

## QC Checklist — Before Any Output
- [ ] NativeWind only (no StyleSheet or inline styles)
- [ ] No `any` TypeScript types
- [ ] Agent registry entry exists if a new agent was added
- [ ] No Supabase calls inside the confession-prep agent
- [ ] Any theological content is cited or flagged as unverified
- [ ] Expo Go compatible (no missing native modules)
- [ ] Follows the folder structure pattern

## Known Gotchas

| Gotcha | Fix |
|--------|-----|
| NativeWind classes not applying in RN | Ensure `nativewind-env.d.ts` is imported in the file |
| Expo Router dynamic route not found | Folder name must exactly match the `slug` in lib/agents.ts |
| Audio playback on Android | expo-av requires permissions; add to `app.json` expo.android.permissions |
| pgvector distance threshold | Use cosine distance < 0.35 for Coptic commentary; tighten to < 0.30 for rites/traditions |
| Supabase magic link in Expo Go | Requires `scheme` in `app.json` for deep link handling |
| TypeScript `AgentUIKind` union | If adding 'guide' for confession, update the union type in `lib/agents.ts` |
| Poimen typecheck floods with react-native/DOM lib errors | Run `npm run typecheck` FROM `poimen/`, not the repo root (root resolves the wrong tsconfig). Run `npm install` first — fresh containers have no node_modules |
| New Supabase query needed in Poimen | Add a function to the relevant `poimen/lib/db/*` module; never call `supabase.from(...)` inside a screen |
