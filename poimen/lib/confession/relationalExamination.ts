// lib/confession/relationalExamination.ts
// Poimen's ORIGINAL examination of conscience (Bishoy's content, preserved
// verbatim from the upstream app): introspective questions organized by
// relationship — Toward God, Toward Others, Toward Self, Omissions. Offered
// alongside the Nepsis senses-based sin catalogue; the user picks their
// preferred style on the Examination screen. Checks from both styles live in
// the same encrypted exam store (the id namespaces don't collide) and merge
// together in the confession notes.

export type RelationalCategory = 'toward_god' | 'toward_others' | 'toward_self' | 'omissions';

export interface RelationalQuestion {
  id: string;
  category: RelationalCategory;
  text: string;
  note?: string;
}

export const RELATIONAL_CATEGORIES: RelationalCategory[] = [
  'toward_god', 'toward_others', 'toward_self', 'omissions',
];

export const RELATIONAL_EXAMINATION: RelationalQuestion[] = [
  // ── Toward God ──
  { id: 'rel_god_1', category: 'toward_god', text: 'Have I neglected or rushed my daily prayers (Agpeya)?', note: 'Reflect on the quality of your prayer, not only its presence.' },
  { id: 'rel_god_2', category: 'toward_god', text: 'Have I attended the Divine Liturgy with full attention and reverence?' },
  { id: 'rel_god_3', category: 'toward_god', text: 'Have I kept the fasts of the Church with sincerity?', note: 'Including the spirit of fasting — prayer, almsgiving, and avoidance of entertainment.' },
  { id: 'rel_god_4', category: 'toward_god', text: 'Have I read and meditated on Scripture regularly?' },
  { id: 'rel_god_5', category: 'toward_god', text: "Have I harbored doubt, despair, or distrust in God's providence?" },
  { id: 'rel_god_6', category: 'toward_god', text: 'Have I exposed myself to content that weakens my faith or darkens my mind?' },
  { id: 'rel_god_7', category: 'toward_god', text: 'Have I been thankful to God for His gifts and blessings?' },

  // ── Toward Others ──
  { id: 'rel_oth_1', category: 'toward_others', text: 'Have I harbored anger, bitterness, or unforgiveness toward anyone?' },
  { id: 'rel_oth_2', category: 'toward_others', text: 'Have I spoken ill of others, gossiped, or judged?' },
  { id: 'rel_oth_3', category: 'toward_others', text: 'Have I been honest in my dealings with others?' },
  { id: 'rel_oth_4', category: 'toward_others', text: 'Have I been generous with my time, treasure, and talents?' },
  { id: 'rel_oth_5', category: 'toward_others', text: 'Have I neglected those in need around me?' },

  // ── Toward Self ──
  { id: 'rel_self_1', category: 'toward_self', text: 'Have I indulged in impure thoughts, speech, or actions?' },
  { id: 'rel_self_2', category: 'toward_self', text: 'Have I been enslaved to any habit or addiction?' },
  { id: 'rel_self_3', category: 'toward_self', text: 'Have I given adequate care to my body as a temple of the Holy Spirit?' },
  { id: 'rel_self_4', category: 'toward_self', text: 'Have I been proud, boastful, or unwilling to receive correction?' },
  { id: 'rel_self_5', category: 'toward_self', text: 'Have I compared myself to others with envy or contempt?' },

  // ── Omissions ──
  { id: 'rel_om_1', category: 'omissions', text: 'Have I neglected to pray for others — my family, enemies, or the departed?' },
  { id: 'rel_om_2', category: 'omissions', text: 'Have I failed to give alms or help those in need when I had the means?' },
  { id: 'rel_om_3', category: 'omissions', text: 'Have I omitted visiting the sick, the lonely, or those in hardship?' },
  { id: 'rel_om_4', category: 'omissions', text: 'Have I failed to honor my spouse, children, or parents as God calls me to?' },
  { id: 'rel_om_5', category: 'omissions', text: 'Have I left good works undone out of laziness, fear, or indifference?' },
  { id: 'rel_om_6', category: 'omissions', text: 'Have I neglected to give thanks to God for His mercies?' },
];
