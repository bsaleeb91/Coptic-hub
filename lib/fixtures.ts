/**
 * Fake data for the shell mockup. Everything on screen in commit 1 comes from here.
 * Each section is isolated so commit 1.5 can replace them one at a time with real hooks.
 *
 * NOTE: Psalm text uses KJV (public domain) for the mockup. Commit 3 will decide
 * whether to license NKJV (per SPEC.md) or ship a public-domain translation.
 */

// ============================================================================
// Chat fixtures (Bible Commentary + Rites & Traditions)
// ============================================================================

export interface FakeCitation {
  id: string;
  sourceTitle: string;
  pageStart: number;
  pageEnd: number;
  excerpt: string;
}

export interface FakeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: FakeCitation[];
  refused?: boolean;
  createdAt: string;
}

export const BIBLE_COMMENTARY_MESSAGES: FakeMessage[] = [
  {
    id: 'm1',
    role: 'user',
    content: 'What do the Fathers say about Genesis 1:1 — why does it begin "In the beginning"?',
    createdAt: '10:02 AM',
  },
  {
    id: 'm2',
    role: 'assistant',
    content:
      'Several Fathers treat "In the beginning" as a reference to Christ, the Word through whom all things were made [1]. St. Augustine reads it as establishing that creation is not eternal — time itself begins here [2]. The Coptic tradition emphasizes the Trinitarian reading: the Father creates, through the Son, by the Holy Spirit.',
    citations: [
      {
        id: 'c1',
        sourceTitle: 'Homilies on Genesis — St. John Chrysostom',
        pageStart: 12,
        pageEnd: 14,
        excerpt:
          '"In the beginning" — that is, through the Word. For the Evangelist John teaches us that all things were made through Him, and without Him was nothing made that was made.',
      },
      {
        id: 'c2',
        sourceTitle: 'Confessions — St. Augustine, Book XI',
        pageStart: 287,
        pageEnd: 291,
        excerpt:
          'You created all times and You exist before all times. Nor was there any time when there was no time. "In the beginning" therefore does not mean a moment within time, but the origin of time itself.',
      },
    ],
    createdAt: '10:02 AM',
  },
  {
    id: 'm3',
    role: 'user',
    content: 'What about the scientific age of the universe?',
    createdAt: '10:04 AM',
  },
  {
    id: 'm4',
    role: 'assistant',
    content:
      "I couldn't find this in the provided commentaries. Try rephrasing, or upload a source that discusses science and Genesis.",
    refused: true,
    createdAt: '10:04 AM',
  },
];

export const RITES_MESSAGES: FakeMessage[] = [
  {
    id: 'r1',
    role: 'user',
    content: 'How many bows are made during the Litany of the Gospel?',
    createdAt: '9:14 AM',
  },
  {
    id: 'r2',
    role: 'assistant',
    content:
      'The Deacon and the congregation bow three times during the Litany of the Gospel — once at the mention of the Father, once at the Son, and once at the Holy Spirit [1]. In the Bohairic tradition a fourth metania is offered before the reading begins [2].',
    citations: [
      {
        id: 'rc1',
        sourceTitle: 'The Rites of the Coptic Orthodox Church — Ch. 4',
        pageStart: 88,
        pageEnd: 89,
        excerpt:
          'At each invocation of a Person of the Trinity the people bow in reverence, making a full metania.',
      },
      {
        id: 'rc2',
        sourceTitle: 'Bohairic Liturgical Guide',
        pageStart: 41,
        pageEnd: 41,
        excerpt:
          'In Bohairic parishes an additional metania is made immediately before the Gospel reading commences.',
      },
    ],
    createdAt: '9:14 AM',
  },
];

// ============================================================================
// Psalm Memorization (per SPEC.md)
// ============================================================================

export interface FakePsalmChunk {
  chunkNumber: number;
  verseRange: string;
  text: string;
}

export interface FakePsalm {
  id: number;
  number: string;
  title: string;
  verseCount: number;
  chunks: FakePsalmChunk[];
  mastery: 'locked' | 'in-progress' | 'mastered';
  /** 0-4: 0 = not started, 4 = mastered (3 correct recitations) */
  progressLevel: number;
}

export const PSALMS: FakePsalm[] = [
  {
    id: 1,
    number: 'Psalm 1',
    title: 'The Way of the Righteous',
    verseCount: 6,
    mastery: 'in-progress',
    progressLevel: 2,
    chunks: [
      {
        chunkNumber: 1,
        verseRange: 'v1–2',
        text:
          'Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful. But his delight is in the law of the LORD; and in his law doth he meditate day and night.',
      },
      {
        chunkNumber: 2,
        verseRange: 'v3–4',
        text:
          'And he shall be like a tree planted by the rivers of water, that bringeth forth his fruit in his season; his leaf also shall not wither; and whatsoever he doeth shall prosper. The ungodly are not so: but are like the chaff which the wind driveth away.',
      },
      {
        chunkNumber: 3,
        verseRange: 'v5–6',
        text:
          'Therefore the ungodly shall not stand in the judgment, nor sinners in the congregation of the righteous. For the LORD knoweth the way of the righteous: but the way of the ungodly shall perish.',
      },
    ],
  },
  {
    id: 23,
    number: 'Psalm 23',
    title: 'The Lord is My Shepherd',
    verseCount: 6,
    mastery: 'mastered',
    progressLevel: 4,
    chunks: [
      {
        chunkNumber: 1,
        verseRange: 'v1–3',
        text:
          'The LORD is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul: he leadeth me in the paths of righteousness for his name\u2019s sake.',
      },
      {
        chunkNumber: 2,
        verseRange: 'v4–6',
        text:
          'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me. Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over. Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.',
      },
    ],
  },
  {
    id: 27,
    number: 'Psalm 27:1',
    title: 'The Lord is My Light',
    verseCount: 1,
    mastery: 'in-progress',
    progressLevel: 1,
    chunks: [
      {
        chunkNumber: 0,
        verseRange: 'v1',
        text:
          'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?',
      },
    ],
  },
  {
    id: 46,
    number: 'Psalm 46',
    title: 'God is Our Refuge',
    verseCount: 11,
    mastery: 'locked',
    progressLevel: 0,
    chunks: [
      {
        chunkNumber: 1,
        verseRange: 'v1–3',
        text:
          'God is our refuge and strength, a very present help in trouble. Therefore will not we fear, though the earth be removed, and though the mountains be carried into the midst of the sea; though the waters thereof roar and be troubled, though the mountains shake with the swelling thereof. Selah.',
      },
      { chunkNumber: 2, verseRange: 'v4–7', text: '[additional verses loaded in commit 3]' },
      { chunkNumber: 3, verseRange: 'v8–11', text: '[additional verses loaded in commit 3]' },
    ],
  },
  {
    id: 91,
    number: 'Psalm 91',
    title: 'The Boss Level',
    verseCount: 16,
    mastery: 'locked',
    progressLevel: 0,
    chunks: [
      {
        chunkNumber: 1,
        verseRange: 'v1–4',
        text:
          'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.',
      },
      { chunkNumber: 2, verseRange: 'v5–9', text: '[additional verses loaded in commit 3]' },
      { chunkNumber: 3, verseRange: 'v10–13', text: '[additional verses loaded in commit 3]' },
      { chunkNumber: 4, verseRange: 'v14–16', text: '[additional verses loaded in commit 3]' },
    ],
  },
  {
    id: 100,
    number: 'Psalm 100',
    title: 'Make a Joyful Noise',
    verseCount: 5,
    mastery: 'locked',
    progressLevel: 0,
    chunks: [
      {
        chunkNumber: 1,
        verseRange: 'v1–3',
        text:
          'Make a joyful noise unto the LORD, all ye lands. Serve the LORD with gladness: come before his presence with singing. Know ye that the LORD he is God: it is he that hath made us, and not we ourselves; we are his people, and the sheep of his pasture.',
      },
      {
        chunkNumber: 2,
        verseRange: 'v4–5',
        text:
          'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name. For the LORD is good; his mercy is everlasting; and his truth endureth to all generations.',
      },
    ],
  },
  {
    id: 119,
    number: 'Psalm 119:105',
    title: 'Thy Word is a Lamp',
    verseCount: 1,
    mastery: 'locked',
    progressLevel: 0,
    chunks: [
      {
        chunkNumber: 0,
        verseRange: 'v105',
        text: 'Thy word is a lamp unto my feet, and a light unto my path.',
      },
    ],
  },
  {
    id: 121,
    number: 'Psalm 121',
    title: 'I Will Lift Up Mine Eyes',
    verseCount: 8,
    mastery: 'locked',
    progressLevel: 0,
    chunks: [
      {
        chunkNumber: 1,
        verseRange: 'v1–4',
        text:
          'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.',
      },
      { chunkNumber: 2, verseRange: 'v5–8', text: '[additional verses loaded in commit 3]' },
    ],
  },
];

export interface FakeLeaderboardRow {
  rank: number;
  name: string;
  points: number;
  streak: number;
  isYou?: boolean;
}

export const LEADERBOARD: FakeLeaderboardRow[] = [
  { rank: 1, name: 'Mina G.', points: 2840, streak: 21 },
  { rank: 2, name: 'Mariam S.', points: 2610, streak: 18 },
  { rank: 3, name: 'You', points: 2195, streak: 12, isYou: true },
  { rank: 4, name: 'Boutros K.', points: 1920, streak: 9 },
  { rank: 5, name: 'Veronica A.', points: 1755, streak: 14 },
  { rank: 6, name: 'Abanoub T.', points: 1340, streak: 5 },
  { rank: 7, name: 'Demiana R.', points: 1180, streak: 3 },
];

export const PSALM_DASHBOARD = {
  currentPsalm: 'Psalm 1',
  currentChunk: 'v3–4',
  currentMode: 'First Letter Hints' as const,
  totalPoints: 2195,
  streak: 12,
  verseOfTheDay: {
    reference: 'Psalm 27:1',
    text:
      'The LORD is my light and my salvation; whom shall I fear? The LORD is the strength of my life; of whom shall I be afraid?',
  },
};

// ============================================================================
// Coptic Language
// ============================================================================

export interface CopticLetter {
  glyph: string;
  name: string;
  transliteration: string;
  value: string;
}

export const COPTIC_ALPHABET: CopticLetter[] = [
  { glyph: 'Ⲁ', name: 'Alpha', transliteration: 'a', value: 'ah' },
  { glyph: 'Ⲃ', name: 'Vida', transliteration: 'v', value: 'v / b' },
  { glyph: 'Ⲅ', name: 'Gamma', transliteration: 'g', value: 'g' },
  { glyph: 'Ⲇ', name: 'Delta', transliteration: 'd', value: 'd / th' },
  { glyph: 'Ⲉ', name: 'Ei', transliteration: 'e', value: 'eh' },
  { glyph: 'Ⲋ', name: 'Soou', transliteration: '6', value: 'six' },
  { glyph: 'Ⲍ', name: 'Zeta', transliteration: 'z', value: 'z' },
  { glyph: 'Ⲏ', name: 'Eeta', transliteration: 'ee', value: 'ee' },
  { glyph: 'Ⲑ', name: 'Theta', transliteration: 'th', value: 'th' },
  { glyph: 'Ⲓ', name: 'Yota', transliteration: 'i', value: 'ee / y' },
];

// ============================================================================
// Hymn Memorization
// ============================================================================

export interface FakeHymn {
  id: string;
  title: string;
  dialect: 'Bohairic' | 'Greek' | 'Arabic';
  season: string;
  verses: string[];
}

export const HYMNS: FakeHymn[] = [
  {
    id: 'agios',
    title: 'Agios O Theos',
    dialect: 'Greek',
    season: 'Year-round',
    verses: [
      'Agios O Theos,',
      'Agios Ischyros,',
      'Agios Athanatos,',
      'Eleison imas.',
    ],
  },
  {
    id: 'tai-shori',
    title: 'Tai Shori',
    dialect: 'Bohairic',
    season: 'Censer hymn',
    verses: [
      'Tai shori enshoue enatthomes,',
      'etkhen nenjij enAaron piouib,',
      'efertalin enousthoinoufi,',
      'ehrei ejen pimanerswoushi.',
    ],
  },
  {
    id: 'golgotha',
    title: 'Golgotha',
    dialect: 'Arabic',
    season: 'Great Lent',
    verses: ['[Hymn text loaded in commit 6]'],
  },
];

// ============================================================================
// Sermon Digest
// ============================================================================

export const SERMON_SUMMARY = {
  title: 'On the Mercy of God',
  preacher: 'Fr. Antony',
  date: 'Sunday, Mar 30',
  themes: ['Repentance', 'God\u2019s patience', 'The prodigal son'],
  outline: [
    'The father runs to meet the son — God acts first',
    'Repentance as a return, not a performance',
    'Mercy is not earned; it is received',
    'What we do with mercy: become merciful ourselves',
  ],
  questions: [
    'Where in my life am I still "far off" from the Father?',
    'Have I ever withheld mercy the way the older brother did?',
    'How do I practice returning daily?',
  ],
};

// ============================================================================
// Sunday School Projects
// ============================================================================

export interface FakeProject {
  id: string;
  title: string;
  dueDate: string;
  status: 'planning' | 'in-progress' | 'done';
  tasks: { title: string; done: boolean }[];
}

export const PROJECTS: FakeProject[] = [
  {
    id: 'p1',
    title: 'Holy Week Skit',
    dueDate: 'Apr 12',
    status: 'in-progress',
    tasks: [
      { title: 'Assign parts to 5th graders', done: true },
      { title: 'Print scripts', done: true },
      { title: 'Rehearsal Saturday 3pm', done: false },
      { title: 'Costumes from storage', done: false },
    ],
  },
  {
    id: 'p2',
    title: 'Saint of the Month — St. Moses the Black',
    dueDate: 'Apr 30',
    status: 'planning',
    tasks: [
      { title: 'Prepare 1-page bio', done: false },
      { title: 'Craft: make a desert diorama', done: false },
      { title: 'Discussion questions', done: false },
    ],
  },
];

// ============================================================================
// Library (cross-agent sources)
// ============================================================================

export interface FakeSource {
  id: string;
  title: string;
  agentSlug: string;
  pageCount: number;
  status: 'ready' | 'processing';
  uploadedAt: string;
}

export const SOURCES: FakeSource[] = [
  {
    id: 's1',
    title: 'Homilies on Genesis — St. John Chrysostom',
    agentSlug: 'bible-commentary',
    pageCount: 342,
    status: 'ready',
    uploadedAt: 'Mar 12',
  },
  {
    id: 's2',
    title: 'Confessions — St. Augustine',
    agentSlug: 'bible-commentary',
    pageCount: 418,
    status: 'ready',
    uploadedAt: 'Mar 15',
  },
  {
    id: 's3',
    title: 'The Rites of the Coptic Orthodox Church',
    agentSlug: 'rites-traditions',
    pageCount: 201,
    status: 'ready',
    uploadedAt: 'Mar 20',
  },
  {
    id: 's4',
    title: 'Bohairic Liturgical Guide',
    agentSlug: 'rites-traditions',
    pageCount: 88,
    status: 'processing',
    uploadedAt: 'Today',
  },
];

// ============================================================================
// Progress dashboard
// ============================================================================

export const PROGRESS_SUMMARY = {
  psalmsMastered: 1,
  psalmsInProgress: 2,
  totalPoints: 2195,
  currentStreak: 12,
  lastActivity: 'Today, 10:12 AM',
  recentActivity: [
    { agent: 'Psalm Memorization', detail: 'Psalm 1 chunk 2 — first letter hints', when: '12m ago' },
    { agent: 'Bible Commentary', detail: 'Asked about Genesis 1:1', when: '1h ago' },
    { agent: 'Coptic Language', detail: 'Alphabet drill — 8/10 correct', when: 'Yesterday' },
  ],
};
