// Centralized dummy database for demo mode.
// All screens import from here instead of defining local DEMO_* arrays.
// To change demo data, edit this file only.

// ── Fixed IDs ────────────────────────────────────────────────
export const DEMO_IDS = {
  priest:   'demo-priest-bishoy',
  priest2:  'demo-priest-kyrillos',
  servant:  'demo-servant-mary',
  servant2: 'demo-servant-david',
  cong1:    'demo-cong-michael',
  cong2:    'demo-cong-sara',
  cong3:    'demo-cong-peter',
  cong4:    'demo-cong-nadia',
  cong5:    'demo-cong-mina',
} as const;

// The "logged in" demo user per role.
export const DEMO_USER: Record<'congregant' | 'priest' | 'servant', { id: string; email: string }> = {
  congregant: { id: DEMO_IDS.cong1,  email: 'michael@demo.coptic' },
  priest:     { id: DEMO_IDS.priest, email: 'fr.bishoy@demo.coptic' },
  servant:    { id: DEMO_IDS.servant, email: 'mary@demo.coptic' },
};

// ── Profiles ─────────────────────────────────────────────────
export const DUMMY_PROFILES = [
  { id: DEMO_IDS.priest,   full_name: 'Fr. Bishoy Marcos',       church_name: "St. Mary's Coptic Orthodox Church", role: 'priest',     avatar_url: null, foc_id: null },
  { id: DEMO_IDS.priest2,  full_name: 'Fr. Kyrillos Abdelmassih',church_name: "St. Mark's Coptic Orthodox Church", role: 'priest',     avatar_url: null, foc_id: null },
  { id: DEMO_IDS.servant,  full_name: 'Mary Naguib',              church_name: "St. Mary's Coptic Orthodox Church", role: 'servant',    avatar_url: null, foc_id: DEMO_IDS.priest },
  { id: DEMO_IDS.servant2, full_name: 'David Asaad',              church_name: "St. Mary's Coptic Orthodox Church", role: 'servant',    avatar_url: null, foc_id: DEMO_IDS.priest },
  { id: DEMO_IDS.cong1,    full_name: 'Michael Hanna',            church_name: "St. Mary's Coptic Orthodox Church", role: 'congregant', avatar_url: null, foc_id: DEMO_IDS.priest },
  { id: DEMO_IDS.cong2,    full_name: 'Sara Girgis',              church_name: "St. Mary's Coptic Orthodox Church", role: 'congregant', avatar_url: null, foc_id: DEMO_IDS.priest },
  { id: DEMO_IDS.cong3,    full_name: 'Peter Botros',             church_name: "St. Mary's Coptic Orthodox Church", role: 'congregant', avatar_url: null, foc_id: DEMO_IDS.priest },
  { id: DEMO_IDS.cong4,    full_name: 'Nadia Henein',             church_name: "St. Mary's Coptic Orthodox Church", role: 'congregant', avatar_url: null, foc_id: DEMO_IDS.priest },
  { id: DEMO_IDS.cong5,    full_name: 'Mina Aziz',                church_name: "St. Mark's Coptic Orthodox Church", role: 'congregant', avatar_url: null, foc_id: DEMO_IDS.priest2 },
] as const;

// ── Pastoral contacts ─────────────────────────────────────────
export const DUMMY_CONTACTS: Record<string, any> = {
  [DEMO_IDS.cong1]: { user_id: DEMO_IDS.cong1, phone: '+1 (614) 555-0182', email: 'michael.hanna@email.com', address: '142 Sunrise Blvd, Columbus OH 43235' },
  [DEMO_IDS.cong2]: { user_id: DEMO_IDS.cong2, phone: '+1 (614) 555-0247', email: 'sara.girgis@email.com',   address: '87 Oak Lane, Columbus OH 43214' },
  [DEMO_IDS.cong3]: { user_id: DEMO_IDS.cong3, phone: '+1 (614) 555-0391', email: 'peter.botros@email.com',  address: '330 Maple Dr, Columbus OH 43220' },
  [DEMO_IDS.cong4]: { user_id: DEMO_IDS.cong4, phone: '+1 (614) 555-0514', email: 'nadia.henein@email.com',  address: '19 Cedar Ct, Columbus OH 43235' },
  [DEMO_IDS.cong5]: { user_id: DEMO_IDS.cong5, phone: '+1 (614) 555-0628', email: 'mina.aziz@email.com',     address: '205 Pine St, Dublin OH 43017' },
};

// ── Life profiles ─────────────────────────────────────────────
export const DUMMY_LIFE_PROFILES: Record<string, any> = {
  [DEMO_IDS.cong1]: { user_id: DEMO_IDS.cong1, life_stage: 'young_family', marital_status: 'married', occupation: 'Software Engineer', birth_year: 1992 },
  [DEMO_IDS.cong2]: { user_id: DEMO_IDS.cong2, life_stage: 'single',       marital_status: 'single',  occupation: 'Nurse',              birth_year: 1998 },
  [DEMO_IDS.cong3]: { user_id: DEMO_IDS.cong3, life_stage: 'college',      marital_status: 'single',  occupation: 'Student',            birth_year: 2003 },
  [DEMO_IDS.cong4]: { user_id: DEMO_IDS.cong4, life_stage: 'established',  marital_status: 'married', occupation: 'Teacher',            birth_year: 1985 },
  [DEMO_IDS.cong5]: { user_id: DEMO_IDS.cong5, life_stage: 'young_family', marital_status: 'married', occupation: 'Accountant',         birth_year: 1990 },
};

// ── Pastoral encounters ───────────────────────────────────────
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const DUMMY_ENCOUNTERS = [
  // Michael Hanna
  { id: 'enc-1', priest_id: DEMO_IDS.priest, congregant_id: DEMO_IDS.cong1, encounter_type: 'confession', encountered_at: daysAgo(47), member_note: 'Fr. Bishoy assigned a 40-day reading plan from the Psalms.' },
  { id: 'enc-2', priest_id: DEMO_IDS.priest, congregant_id: DEMO_IDS.cong1, encounter_type: 'visit',      encountered_at: daysAgo(51), member_note: 'Pastoral visit following the birth of your daughter. Prayers and blessings offered.' },
  { id: 'enc-3', priest_id: DEMO_IDS.priest, congregant_id: DEMO_IDS.cong1, encounter_type: 'confession', encountered_at: daysAgo(96), member_note: 'Holy Week confession. Guidance on family prayer.' },
  { id: 'enc-4', priest_id: DEMO_IDS.priest, congregant_id: DEMO_IDS.cong1, encounter_type: 'group',      encountered_at: daysAgo(115), member_note: 'Discussed the Book of Job with the young couples group.' },
  // Sara Girgis
  { id: 'enc-5', priest_id: DEMO_IDS.priest, congregant_id: DEMO_IDS.cong2, encounter_type: 'confession', encountered_at: daysAgo(18), member_note: 'Discussed fasting and the upcoming Apostles Fast.' },
  { id: 'enc-6', priest_id: DEMO_IDS.priest, congregant_id: DEMO_IDS.cong2, encounter_type: 'counseling', encountered_at: daysAgo(45), member_note: 'Career discernment conversation.' },
  // Peter Botros
  { id: 'enc-7', priest_id: DEMO_IDS.priest, congregant_id: DEMO_IDS.cong3, encounter_type: 'confession', encountered_at: daysAgo(74), member_note: 'Reminded to attend Sunday Liturgy more consistently.' },
  // Nadia Henein
  { id: 'enc-8', priest_id: DEMO_IDS.priest, congregant_id: DEMO_IDS.cong4, encounter_type: 'confession', encountered_at: daysAgo(22), member_note: 'Regular confession. Spiritual growth noted.' },
  { id: 'enc-9', priest_id: DEMO_IDS.priest, congregant_id: DEMO_IDS.cong4, encounter_type: 'phone',      encountered_at: daysAgo(60), member_note: 'Called to check in about family situation.' },
];

// ── Spiritual canons ──────────────────────────────────────────
export const DUMMY_CANONS = [
  // Michael Hanna — active
  { id: 'canon-1', congregant_id: DEMO_IDS.cong1, priest_id: DEMO_IDS.priest, component: 'Agpeya Morning Prayer', frequency: 'Daily',  active: true,  icon: '🙏', start_date: daysAgo(40), end_date: null,     reflection_prompt: 'Note one phrase that stayed with you.' },
  { id: 'canon-2', congregant_id: DEMO_IDS.cong1, priest_id: DEMO_IDS.priest, component: 'Psalm 50 Reading',      frequency: 'Daily',  active: true,  icon: '📖', start_date: daysAgo(40), end_date: null,     reflection_prompt: null },
  { id: 'canon-3', congregant_id: DEMO_IDS.cong1, priest_id: DEMO_IDS.priest, component: 'Almsgiving',            frequency: 'Weekly', active: true,  icon: '❤',  start_date: daysAgo(40), end_date: null,     reflection_prompt: null },
  // Michael Hanna — inactive
  { id: 'canon-4', congregant_id: DEMO_IDS.cong1, priest_id: DEMO_IDS.priest, component: 'Divine Liturgy Attendance', frequency: 'Weekly', active: false, icon: '✝', start_date: daysAgo(120), end_date: daysAgo(50), reflection_prompt: null },
  // Sara Girgis
  { id: 'canon-5', congregant_id: DEMO_IDS.cong2, priest_id: DEMO_IDS.priest, component: 'Evening Agpeya',        frequency: 'Daily',  active: true,  icon: '🌙', start_date: daysAgo(18), end_date: null, reflection_prompt: null },
  { id: 'canon-6', congregant_id: DEMO_IDS.cong2, priest_id: DEMO_IDS.priest, component: 'Scripture Meditation',  frequency: 'Daily',  active: true,  icon: '📖', start_date: daysAgo(18), end_date: null, reflection_prompt: 'One verse that spoke to you today.' },
  // Peter Botros
  { id: 'canon-7', congregant_id: DEMO_IDS.cong3, priest_id: DEMO_IDS.priest, component: 'Morning Agpeya',        frequency: 'Daily',  active: true,  icon: '🙏', start_date: daysAgo(10), end_date: null, reflection_prompt: null },
  // Nadia Henein
  { id: 'canon-8', congregant_id: DEMO_IDS.cong4, priest_id: DEMO_IDS.priest, component: 'Fasting (Nineveh)',     frequency: 'Weekly', active: true,  icon: '🌿', start_date: daysAgo(30), end_date: null, reflection_prompt: null },
  { id: 'canon-9', congregant_id: DEMO_IDS.cong4, priest_id: DEMO_IDS.priest, component: 'Service / Diakonia',   frequency: 'Weekly', active: true,  icon: '◇',  start_date: daysAgo(30), end_date: null, reflection_prompt: null },
];

// ── Canon completions ─────────────────────────────────────────
function dateStr(daysAgoN: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgoN);
  return d.toISOString().split('T')[0];
}

export const DUMMY_COMPLETIONS = [
  // canon-1 (Michael daily prayer) — completed 28 of 40 days
  ...[0,1,2,3,4,5,6,8,9,10,11,12,13,14,16,17,18,19,20,21,22,24,25,26,27,28,29,30].map(d => ({ id: `cc1-${d}`, canon_id: 'canon-1', user_id: DEMO_IDS.cong1, completed_on: dateStr(d) })),
  // canon-2 (Psalm 50) — completed 25 of 40 days
  ...[0,1,2,3,5,6,7,8,9,10,12,13,14,15,16,17,19,20,21,22,24,25,26,28,30].map(d => ({ id: `cc2-${d}`, canon_id: 'canon-2', user_id: DEMO_IDS.cong1, completed_on: dateStr(d) })),
  // canon-3 (Almsgiving) weekly — 4 completions
  ...[0,7,14,21].map(d => ({ id: `cc3-${d}`, canon_id: 'canon-3', user_id: DEMO_IDS.cong1, completed_on: dateStr(d) })),
  // canon-5 (Sara evening) — 12 of 18 days
  ...[0,1,2,3,4,6,7,8,10,11,14,16].map(d => ({ id: `cc5-${d}`, canon_id: 'canon-5', user_id: DEMO_IDS.cong2, completed_on: dateStr(d) })),
  // canon-6 (Sara scripture) — 15 of 18 days
  ...[0,1,2,3,4,5,6,7,8,9,11,12,14,15,16].map(d => ({ id: `cc6-${d}`, canon_id: 'canon-6', user_id: DEMO_IDS.cong2, completed_on: dateStr(d) })),
  // canon-7 (Peter morning) — 4 of 10 days
  ...[0,2,5,8].map(d => ({ id: `cc7-${d}`, canon_id: 'canon-7', user_id: DEMO_IDS.cong3, completed_on: dateStr(d) })),
];

// ── Prayer requests ───────────────────────────────────────────
export const DUMMY_PRAYER_REQUESTS = [
  { id: 'pr-1', user_id: DEMO_IDS.cong1, category: 'family',        visibility: 'foc_only',       answered: false, created_at: daysAgo(5) },
  { id: 'pr-2', user_id: DEMO_IDS.cong1, category: 'health',        visibility: 'foc_and_servant',answered: false, created_at: daysAgo(12) },
  { id: 'pr-3', user_id: DEMO_IDS.cong1, category: 'work',          visibility: 'private',         answered: false, created_at: daysAgo(20) },
  { id: 'pr-4', user_id: DEMO_IDS.cong1, category: 'faith',         visibility: 'foc_only',        answered: true,  created_at: daysAgo(60) },
  { id: 'pr-5', user_id: DEMO_IDS.cong2, category: 'relationships', visibility: 'foc_only',        answered: false, created_at: daysAgo(3) },
  { id: 'pr-6', user_id: DEMO_IDS.cong2, category: 'gratitude',     visibility: 'foc_and_servant', answered: false, created_at: daysAgo(15) },
  { id: 'pr-7', user_id: DEMO_IDS.cong3, category: 'work',          visibility: 'foc_only',        answered: false, created_at: daysAgo(8) },
  { id: 'pr-8', user_id: DEMO_IDS.cong4, category: 'family',        visibility: 'foc_only',        answered: false, created_at: daysAgo(2) },
  { id: 'pr-9', user_id: DEMO_IDS.cong4, category: 'health',        visibility: 'servant_only',    answered: false, created_at: daysAgo(10) },
];

// ── Agent progress (vitals, journal disciplines/entries) ──────
export const DUMMY_PROGRESS: Record<string, Record<string, any>> = {
  [DEMO_IDS.cong1]: {
    vitals: { prayer: 65, scripture: 80, liturgy: 80, fasting: 90, service: 50 },
    'journal-disciplines': [
      { id: 'disc-1', icon: '🙏', name: 'Morning Agpeya',       freq: 'daily',     streak: '5-day streak', shared: true,  done: true },
      { id: 'disc-2', icon: '📖', name: 'Bible Reading',        freq: 'daily',     streak: '5-day streak', shared: true,  done: false },
      { id: 'disc-3', icon: '🕯', name: 'Vespers',              freq: 'weekly',    streak: '3 this month', shared: true,  done: false },
      { id: 'disc-4', icon: '✝', name: 'Divine Liturgy',       freq: 'weekly',    streak: '8/10 Sundays', shared: true,  done: true },
      { id: 'disc-5', icon: '❤', name: 'Almsgiving',           freq: 'monthly',   streak: '',             shared: false, done: false },
      { id: 'disc-6', icon: '🌿', name: 'Day of Prayer',        freq: 'quarterly', streak: '',             shared: true,  done: false },
    ],
    'journal-entries': [
      { id: 'je-1', created_at: daysAgo(1),  title: 'Reflection on Psalm 23',       reflection: 'The Lord is my shepherd — I noticed how this psalm pairs provision with peace.',   scripture: 'Psalm 23:1',   prayer_intention: 'For patience with my children.' },
      { id: 'je-2', created_at: daysAgo(5),  title: 'After the Divine Liturgy',     reflection: 'The doxology of the Theotokos moved me unexpectedly today.',                     scripture: 'Luke 1:46-55', prayer_intention: 'For Mary Naguib and her family.' },
      { id: 'je-3', created_at: daysAgo(12), title: 'Morning fast reflection',       reflection: 'Found it easier this week. Less food, more awareness.',                          scripture: 'Matthew 6:16', prayer_intention: 'For strength during the Apostles Fast.' },
    ],
    'pastoral-notes-self': null,
  },
  [DEMO_IDS.cong2]: {
    vitals: { prayer: 90, scripture: 88, liturgy: 95, fasting: 75, service: 60 },
    'journal-disciplines': [
      { id: 'disc-a', icon: '🙏', name: 'Evening Prayer',   freq: 'daily',  streak: '12-day streak', shared: true,  done: true },
      { id: 'disc-b', icon: '📖', name: 'Daily Scripture',  freq: 'daily',  streak: '12-day streak', shared: true,  done: true },
      { id: 'disc-c', icon: '✝', name: 'Sunday Liturgy',   freq: 'weekly', streak: '10/10 Sundays', shared: true,  done: false },
    ],
    'journal-entries': [],
  },
  [DEMO_IDS.cong3]: {
    vitals: { prayer: 20, scripture: 15, liturgy: 40, fasting: 10, service: 5 },
    'journal-disciplines': [],
    'journal-entries': [],
  },
  [DEMO_IDS.cong4]: {
    vitals: { prayer: 85, scripture: 75, liturgy: 90, fasting: 80, service: 70 },
    'journal-disciplines': [
      { id: 'disc-d', icon: '🙏', name: 'Agpeya (3 hours)',  freq: 'daily',   streak: '20-day streak', shared: true, done: true },
      { id: 'disc-e', icon: '🌿', name: 'Fasting',           freq: 'weekly',  streak: 'Every Wed+Fri', shared: true, done: false },
    ],
    'journal-entries': [],
  },
  // Priest pastoral notes per member
  [`${DEMO_IDS.priest}-pastoral-notes-${DEMO_IDS.cong1}`]: {
    text: 'Michael is growing steadily. New father — pray for him as he navigates family life. Assigned 40-day Psalm plan after May confession. Follow up in August.',
    updated_at: daysAgo(47),
  },
  [`${DEMO_IDS.priest}-pastoral-notes-${DEMO_IDS.cong3}`]: {
    text: 'Peter is struggling with attendance. Second missed appointment. Needs gentle but firm follow-up. Consider involving servant.',
    updated_at: daysAgo(10),
  },
};

// ── Servant students mapping ──────────────────────────────────
// Mary Naguib serves cong1, cong2, cong3 as Sunday school students
export const DUMMY_SERVANT_STUDENTS: Record<string, string[]> = {
  [DEMO_IDS.servant]:  [DEMO_IDS.cong1, DEMO_IDS.cong2, DEMO_IDS.cong3],
  [DEMO_IDS.servant2]: [DEMO_IDS.cong4, DEMO_IDS.cong5],
};

// ── Query helpers (used by screens directly in demo mode) ────

export function dummyGetProfile(userId: string) {
  return DUMMY_PROFILES.find(p => p.id === userId) ?? null;
}

export function dummyGetFocProfile(focId: string) {
  const p = DUMMY_PROFILES.find(p => p.id === focId);
  return p ? { full_name: p.full_name, church_name: p.church_name } : null;
}

export function dummyGetFlock(priestId: string) {
  return DUMMY_PROFILES.filter(p => p.foc_id === priestId);
}

export function dummyGetConfessionsForPriest(priestId: string) {
  return DUMMY_ENCOUNTERS
    .filter(e => e.priest_id === priestId && e.encounter_type === 'confession')
    .map(e => ({ congregant_id: e.congregant_id, encountered_at: e.encountered_at }));
}

export function dummyGetConfessionsForCongregant(congregantId: string) {
  return DUMMY_ENCOUNTERS
    .filter(e => e.congregant_id === congregantId && e.encounter_type === 'confession')
    .map(e => ({ id: e.id, encountered_at: e.encountered_at, member_note: e.member_note }));
}

export function dummyGetRecentEncounters(congregantId: string, limit: number) {
  return DUMMY_ENCOUNTERS
    .filter(e => e.congregant_id === congregantId)
    .sort((a, b) => b.encountered_at.localeCompare(a.encountered_at))
    .slice(0, limit)
    .map(e => ({ encounter_type: e.encounter_type, encountered_at: e.encountered_at, member_note: e.member_note }));
}

export function dummyGetMemberProfile(memberId: string) {
  const p = DUMMY_PROFILES.find(p => p.id === memberId);
  return p ? { full_name: p.full_name, created_at: daysAgo(365), role: p.role } : null;
}

export function dummyGetActiveCanons(congregantId: string) {
  return DUMMY_CANONS.filter(c => c.congregant_id === congregantId && c.active);
}

export function dummyGetInactiveCanons(congregantId: string) {
  return DUMMY_CANONS
    .filter(c => c.congregant_id === congregantId && !c.active)
    .map(c => ({ id: c.id, component: c.component, start_date: c.start_date, end_date: c.end_date, frequency: c.frequency }));
}

export function dummyGetMemberActiveCanons(memberId: string) {
  return DUMMY_CANONS
    .filter(c => c.congregant_id === memberId && c.active)
    .map(c => ({ id: c.id, component: c.component, frequency: c.frequency, start_date: c.start_date }));
}

export function dummyGetStudentActiveCanons(studentId: string, servantId: string) {
  return DUMMY_CANONS
    .filter(c => c.congregant_id === studentId && c.priest_id === servantId && c.active)
    .map(c => ({ id: c.id, component: c.component, frequency: c.frequency, start_date: c.start_date }));
}

export function dummyGetActiveCanonContext(memberId: string) {
  return DUMMY_CANONS
    .filter(c => c.congregant_id === memberId && c.active)
    .map(c => ({ component: c.component, frequency: c.frequency }));
}

export function dummyGetActiveCanonsByPriest(priestId: string) {
  return DUMMY_CANONS
    .filter(c => c.priest_id === priestId && c.active)
    .map(c => ({ congregant_id: c.congregant_id }));
}

export function dummyCountCanonCompletions(canonId: string): number {
  return DUMMY_COMPLETIONS.filter(c => c.canon_id === canonId).length;
}

export function dummyCountCanonCompletionsSince(canonId: string, sinceDate: string): number {
  return DUMMY_COMPLETIONS.filter(c => c.canon_id === canonId && c.completed_on >= sinceDate).length;
}

export function dummyGetPrayerRequests(userId: string) {
  return DUMMY_PRAYER_REQUESTS.filter(r => r.user_id === userId);
}

export function dummyGetFocPrayerRequests(memberId: string) {
  return DUMMY_PRAYER_REQUESTS
    .filter(r => r.user_id === memberId && ['foc_only', 'foc_and_servant'].includes(r.visibility) && !r.answered)
    .map(r => ({ created_at: r.created_at, category: r.category }));
}

export function dummyGetServantSharedPrayer(studentId: string) {
  return DUMMY_PRAYER_REQUESTS
    .filter(r => r.user_id === studentId && ['servant_only', 'foc_and_servant'].includes(r.visibility) && !r.answered)
    .map(r => ({ created_at: r.created_at, category: r.category }));
}

export function dummyGetAgentProgress(userId: string, slug: string): any | null {
  return DUMMY_PROGRESS[userId]?.[slug] ?? null;
}

export function dummyGetServantStudents(servantId: string) {
  const ids = DUMMY_SERVANT_STUDENTS[servantId] ?? [];
  return DUMMY_PROFILES.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, full_name: p.full_name }));
}

export function dummyGetContact(userId: string) {
  return DUMMY_CONTACTS[userId] ?? null;
}

export function dummyGetLifeProfile(userId: string) {
  return DUMMY_LIFE_PROFILES[userId] ?? null;
}

export function dummyGetAllProfiles() {
  return [...DUMMY_PROFILES];
}

// Last confession date for a congregant (used by canon readiness).
export function dummyDaysSinceConfession(congregantId: string): number | null {
  const confessions = DUMMY_ENCOUNTERS
    .filter(e => e.congregant_id === congregantId && e.encounter_type === 'confession')
    .sort((a, b) => b.encountered_at.localeCompare(a.encountered_at));
  if (confessions.length === 0) return null;
  const diff = Date.now() - new Date(confessions[0].encountered_at).getTime();
  return Math.floor(diff / 86400000);
}
