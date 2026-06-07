# COMPONENTS.md — Component Library & Screen Patterns

All shared components live in `components/`. Use these before reaching for primitives.
Every component uses NativeWind only — no StyleSheet, no inline styles.

---

## Screen Wrapper — `Screen`

**File:** `components/Screen.tsx`
**Use for:** Every top-level route screen. Handles SafeArea, background color, and optional scroll.

```tsx
// Scrollable (default) — use for most screens
<Screen>
  <Text>content</Text>
</Screen>

// Non-scrollable — use when the screen manages its own scroll (e.g. ChatView)
<Screen scroll={false} contentClassName="px-5 pt-3 pb-4">
  <ChatView ... />
</Screen>

// Background override
<Screen bgClassName="bg-nile-900">...</Screen>
```

**Props:**
| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `scroll` | `boolean` | `true` | Wraps content in ScrollView when true |
| `contentClassName` | `string` | `''` | Classes on the inner container |
| `bgClassName` | `string` | `'bg-parchment-50 dark:bg-nile-900'` | Background override |

**Pattern:** `Screen scroll={false}` + `contentClassName="px-5 pt-3 pb-4"` is the bible-commentary pattern for chat screens. Scrollable screens get `px-5 pt-4 pb-10` automatically.

---

## Agent Header — `AgentHeader`

**File:** `components/AgentHeader.tsx`
**Use for:** Top of an agent's main index screen when you want the themed colored block showing the agent's icon, name, tagline, and grounding badge.

```tsx
const agent = getAgent('bible-commentary')!;
<AgentHeader agent={agent} />
```

Reads `agent.color.base`, `agent.color.accent`, `agent.color.on`, and `agent.grounding` from the registry automatically. Shows `ShieldCheck` + "Grounded answers only" badge when `grounding === 'strict'`.

**Note:** `AgentHeader` is the big colored block. For a slim Stack.Screen header bar, configure `Stack.Screen options={{ title: agent.name }}` instead — see the bible-commentary pattern below.

---

## Chat UI — `ChatView`

**File:** `components/ChatView.tsx`
**Use for:** Any chat-style agent (bible-commentary, rites-traditions, and future agents).

```tsx
<ChatView
  messages={BIBLE_COMMENTARY_MESSAGES}
  placeholder="Ask about the commentaries you've uploaded..."
  emptyHint="Upload a commentary to get started"
/>
```

**Props:**
| Prop | Type | Notes |
|------|------|-------|
| `messages` | `FakeMessage[]` | Stub phase data from fixtures.ts |
| `placeholder` | `string` | Input placeholder text |
| `emptyHint` | `string` | Italic centered text shown when messages is empty |

**Commit 2 change:** ChatView will gain an `onSend: (text: string) => void` prop wired to the `claude-proxy` SSE stream. The Send button is currently a no-op. Do not add send logic before Commit 2 — leave the hook point.

**Internal structure:**
- `ScrollView` of `MessageBubble` components
- `Input` + `Button` send row at the bottom
- `CitationSheet` modal (managed internally via `activeCitation` state)

---

## Message Bubble — `MessageBubble`

**File:** `components/MessageBubble.tsx`
**Use for:** Individual messages inside `ChatView`. Handles user vs. assistant styling and inline citation markers.

```tsx
<MessageBubble message={message} onCitationPress={(c) => setActiveCitation(c)} />
```

**Behavior:**
- `message.refused === true` → renders `RefusalBanner` instead of a bubble
- `message.role === 'user'` → right-aligned, `bg-nile-700`, `text-parchment-50`
- `message.role === 'assistant'` → left-aligned, `bg-parchment-100 dark:bg-nile-800`
- Inline `[1]`, `[2]` markers in `content` are replaced with tappable `incense`-colored citation links

**Commit 2 change:** Citation rendering will switch from regex-parsed `[1]` markers to real citation blocks from Claude's Citations API.

---

## Citation Chip — `CitationChip`

**File:** `components/CitationChip.tsx`
**Use for:** Standalone citation pill (not the inline `[1]` marker — that's inside MessageBubble). Used when you want a row of source chips below a message.

```tsx
<CitationChip citation={citation} index={0} onPress={() => setActiveCitation(citation)} />
```

**Props:** `citation: FakeCitation`, `index: number`, `onPress?: () => void`
Style: `incense`-tinted pill with FileText icon.

---

## Citation Sheet — `CitationSheet`

**File:** `components/CitationSheet.tsx`
**Use for:** Bottom-sheet modal showing full citation detail (title, page range, excerpt). Managed by `ChatView` internally — you only need this directly if building a custom chat layout.

```tsx
<CitationSheet
  citation={activeCitation}
  visible={!!activeCitation}
  onClose={() => setActiveCitation(null)}
/>
```

**Props:** `citation: FakeCitation | null`, `visible: boolean`, `onClose: () => void`
Style: `rounded-t-3xl` bottom sheet over `bg-nile-900/60` overlay.

---

## Refusal Banner — `RefusalBanner`

**File:** `components/RefusalBanner.tsx`
**Use for:** When a strict-grounded agent has no matching sources. Rendered automatically by `MessageBubble` when `message.refused === true`. Use directly only if building a custom layout outside ChatView.

```tsx
<RefusalBanner message="I couldn't find this in the provided commentaries." />
```

Style: `ember`-tinted border + background, `ShieldAlert` icon. Always left-aligned, `max-w-[85%]`.

---

## Drill Card — `DrillCard`

**File:** `components/DrillCard.tsx`
**Use for:** Memorization drill UI (psalms, coptic language, hymns). Shows a mode label, title, verse/prompt, and a footer slot for drill controls.

```tsx
<DrillCard
  title="Psalm 1 — v1–2"
  subtitle="First Letter Hints"
  body="B___ is the man that walketh not..."
  footer={<Button onPress={handleCheck}>Check</Button>}
/>
```

**Props:** `title`, `subtitle?`, `body`, `footer?: ReactNode`
Style: `parchment-50 dark:nile-800` card with `incense-500` left border on the text block.

Also exports `DrillResult`:
```tsx
<DrillResult correct={true} />   // olive-tinted "Correct"
<DrillResult correct={false} />  // ember-tinted "Not quite"
```

---

## Agent Card — `AgentCard`

**File:** `components/AgentCard.tsx`
**Use for:** Hub home grid. Takes an `Agent` from the registry, renders a themed card that navigates to `/agent/{slug}`.

```tsx
<AgentCard agent={agent} />
```

Reads all styling from `agent.color.*`. Shows `StatusDot` (olive=stable, incense=beta, parchment=stub) and `ShieldCheck` badge for strict agents. Navigation is handled internally via `Link`.

---

## Empty State — `EmptyState`

**File:** `components/EmptyState.tsx`
**Use for:** Zero-data screens — first open, no sources uploaded, no drills started, etc.

```tsx
<EmptyState title="No commentaries yet" body="Upload a PDF to get started.">
  <Button onPress={handleUpload}>Upload</Button>
</EmptyState>
```

**Props:** `title: string`, `body?: string`, `children?: ReactNode` (renders below body)

---

## Button — `Button`

**File:** `components/Button.tsx`

```tsx
<Button variant="primary" onPress={handlePress}>Send</Button>
<Button variant="secondary" fullWidth>Cancel</Button>
<Button variant="ghost">Skip</Button>
<Button variant="destructive">Delete</Button>
```

**Variants:**
| Variant | Background | Use when |
|---------|-----------|---------|
| `primary` | `incense-500` | Main action |
| `secondary` | `nile-700` | Secondary action |
| `ghost` | `parchment-100 / nile-800` | Tertiary / cancel |
| `destructive` | `ember-500` | Delete / irreversible |

**Props:** `variant?`, `fullWidth?: boolean`, all `PressableProps`

---

## Input — `Input`

**File:** `components/Input.tsx`

```tsx
<Input placeholder="Ask a question..." value={draft} onChangeText={setDraft} multiline />
<Input label="Your name" placeholder="Mina" />
```

**Props:** `label?: string`, all `TextInputProps`
Style: `parchment-50 / nile-800` background, `parchment-200 / nile-700` border, `parchment-500` placeholder color.

---

## Category Section — `CategorySection`

**File:** `components/CategorySection.tsx`
**Use for:** Hub home groupings ("Study", "Memorization", etc.). Wraps a label + grid of `AgentCard` components.

---

## Screen Patterns

### Chat agent screen (bible-commentary pattern)
```tsx
export default function BibleCommentary() {
  const agent = getAgent('bible-commentary')!;
  return (
    <Screen scroll={false} contentClassName="px-5 pt-3 pb-4">
      <Stack.Screen
        options={{
          title: agent.name,
          headerRight: () => (/* optional action button */),
        }}
      />
      {/* optional inline status badge */}
      <ChatView messages={FIXTURE_DATA} placeholder="..." />
    </Screen>
  );
}
```

### Sources / document list screen (bible-commentary/sources pattern)
```tsx
export default function Sources() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sources' }} />
      {/* Upload trigger — dashed border, incense colors */}
      <Pressable className="mb-5 flex-row items-center justify-center rounded-xl2 border-2 border-dashed border-incense-400 bg-incense-100/30 ...">
        <Upload size={18} color="#C77807" />
        <Text className="ml-2 text-sm font-semibold text-incense-700">Upload a PDF</Text>
      </Pressable>
      {/* Source cards — parchment-50/nile-800, FileText icon, status dot */}
    </Screen>
  );
}
```

### Drill screen (psalm-memorization pattern)
```tsx
export default function PsalmDrill() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Psalm 1 — Drill' }} />
      <DrillCard
        title="v1–2"
        subtitle="Fill in the Blank"
        body={maskedVerse}
        footer={<Button onPress={handleCheck}>Check</Button>}
      />
      <DrillResult correct={lastResult} />
    </Screen>
  );
}
```

### Agent index with AgentHeader (non-chat agents)
```tsx
export default function PsalmIndex() {
  const agent = getAgent('psalm-memorization')!;
  return (
    <Screen>
      <Stack.Screen options={{ title: agent.name }} />
      <AgentHeader agent={agent} />
      {/* dashboard content */}
    </Screen>
  );
}
```

---

## Routing Conventions

- Agent root: `/agent/{slug}` → `app/agent/{slug}/index.tsx`
- Agent sub-screen: `/agent/{slug}/sources` → `app/agent/{slug}/sources.tsx`
- Tab screens: `app/(tabs)/index.tsx` (Hub), `library.tsx`, `progress.tsx`, `settings.tsx`
- Shared agent layout: `app/agent/_layout.tsx` — sets header background to `bg-nile-800`
- All agent routes use `Stack.Screen` to configure the header title (and optional `headerRight`)
- Navigation from an agent screen: `useRouter()` → `router.push('/agent/{slug}/sub-screen')`
