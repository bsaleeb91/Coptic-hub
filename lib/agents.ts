/**
 * Agent registry — single source of truth for every agent in the hub.
 *
 * Adding a new agent = one entry here + one folder under app/agent/{slug}/.
 *
 * The `grounding` flag determines whether the agent must refuse to answer when
 * no source context is retrieved. `strict` agents (Bible Commentary, Rites &
 * Traditions) never hallucinate — they cite or they refuse.
 */

export type GroundingMode = 'strict' | 'loose' | 'none';
export type AgentStatus = 'stable' | 'beta' | 'stub';
export type AgentCategory = 'study' | 'memorization' | 'reference' | 'planning';
export type AgentUIKind = 'chat' | 'drill' | 'planner' | 'summary';

export interface AgentColor {
  /** Tailwind bg class for cards/headers */
  base: string;
  /** Tailwind text class used on top of `base` */
  on: string;
  /** Tailwind bg class for accents (pills, active states) */
  accent: string;
}

export interface Agent {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  /** Icon key, mapped to a Lucide component in lib/icons.ts */
  icon: string;
  color: AgentColor;
  category: AgentCategory;
  status: AgentStatus;
  grounding: GroundingMode;
  /** Which screen shape this agent uses (chat / drill / planner / summary) */
  ui: AgentUIKind;
  /** What parts of the agent work offline once content is cached */
  offline: { registry: boolean; content: boolean; query: boolean };
  /** If true, the agent's first-run gate is "upload sources" */
  requiresSources: boolean;
  /** Server-side prompt key (wired up in commit 1.5) */
  systemPromptKey: string;
}

export const AGENTS: Agent[] = [
  {
    slug: 'bible-commentary',
    name: 'Bible Commentary',
    tagline: 'Ask questions across your commentaries.',
    description:
      'Grounded answers from PDF commentaries you upload. Cites page and source. Refuses when your sources do not cover the question.',
    icon: 'book-open',
    color: { base: 'bg-nile-700', on: 'text-parchment-50', accent: 'bg-incense-500' },
    category: 'study',
    status: 'beta',
    grounding: 'strict',
    ui: 'chat',
    offline: { registry: true, content: true, query: false },
    requiresSources: true,
    systemPromptKey: 'bible_commentary_strict',
  },
  {
    slug: 'sermon-digest',
    name: 'Sermon Digest',
    tagline: 'Summarize and study sermons.',
    description:
      'Paste a transcript or upload audio and get outlines, themes, and study questions you can bring to a small group.',
    icon: 'mic',
    color: { base: 'bg-nile-600', on: 'text-parchment-50', accent: 'bg-incense-400' },
    category: 'study',
    status: 'stub',
    grounding: 'loose',
    ui: 'summary',
    offline: { registry: true, content: true, query: false },
    requiresSources: false,
    systemPromptKey: 'sermon_digest_default',
  },
  {
    slug: 'psalm-memorization',
    name: 'Psalm Memorization',
    tagline: 'Memorize the Psalter one chunk at a time.',
    description:
      'Four drill modes — study, fill-in-the-blank, first letters, full recitation — with point-based progression and a class leaderboard.',
    icon: 'scroll',
    color: { base: 'bg-incense-600', on: 'text-parchment-50', accent: 'bg-nile-500' },
    category: 'memorization',
    status: 'stub',
    grounding: 'none',
    ui: 'drill',
    offline: { registry: true, content: true, query: true },
    requiresSources: false,
    systemPromptKey: 'psalm_drill_hints',
  },
  {
    slug: 'coptic-language',
    name: 'Coptic Language',
    tagline: 'Learn the alphabet and core vocabulary.',
    description:
      'Drills for the Coptic alphabet, numbers, and everyday liturgical vocabulary in Bohairic pronunciation.',
    icon: 'languages',
    color: { base: 'bg-nile-800', on: 'text-parchment-50', accent: 'bg-incense-400' },
    category: 'memorization',
    status: 'stub',
    grounding: 'none',
    ui: 'drill',
    offline: { registry: true, content: true, query: true },
    requiresSources: false,
    systemPromptKey: 'coptic_drill_hints',
  },
  {
    slug: 'hymn-memorization',
    name: 'Hymn Memorization',
    tagline: 'Text and audio drills for Coptic hymns.',
    description:
      'Learn hymn texts alongside audio in the three Coptic dialects. Every hymn has a study mode and a timed recitation drill.',
    icon: 'music',
    color: { base: 'bg-incense-700', on: 'text-parchment-50', accent: 'bg-nile-500' },
    category: 'memorization',
    status: 'stub',
    grounding: 'none',
    ui: 'drill',
    offline: { registry: true, content: true, query: true },
    requiresSources: false,
    systemPromptKey: 'hymn_drill_hints',
  },
  {
    slug: 'rites-traditions',
    name: 'Rites & Traditions',
    tagline: 'Questions answered from trusted reference texts.',
    description:
      'Grounded reference agent for Coptic Orthodox rites, feasts, and liturgical practice. Every answer cites a reference document.',
    icon: 'church',
    color: { base: 'bg-nile-900', on: 'text-parchment-50', accent: 'bg-incense-500' },
    category: 'reference',
    status: 'stub',
    grounding: 'strict',
    ui: 'chat',
    offline: { registry: true, content: false, query: false },
    requiresSources: true,
    systemPromptKey: 'rites_reference_strict',
  },
  {
    slug: 'sunday-school',
    name: 'Sunday School Projects',
    tagline: 'Plan, schedule, and track SS projects.',
    description:
      'Helper for Sunday School teachers: lesson plans, class rosters, project tracking, and reminders.',
    icon: 'clipboard-list',
    color: { base: 'bg-incense-500', on: 'text-parchment-900', accent: 'bg-nile-600' },
    category: 'planning',
    status: 'stub',
    grounding: 'loose',
    ui: 'planner',
    offline: { registry: true, content: true, query: false },
    requiresSources: false,
    systemPromptKey: 'sunday_school_default',
  },
];

export const CATEGORIES: { key: AgentCategory; label: string }[] = [
  { key: 'study', label: 'Study' },
  { key: 'memorization', label: 'Memorization' },
  { key: 'reference', label: 'Reference' },
  { key: 'planning', label: 'Planning' },
];

export function getAgent(slug: string): Agent | undefined {
  return AGENTS.find((a) => a.slug === slug);
}

export function agentsByCategory(category: AgentCategory): Agent[] {
  return AGENTS.filter((a) => a.category === category);
}

export const STRICT_AGENTS = AGENTS.filter((a) => a.grounding === 'strict');
