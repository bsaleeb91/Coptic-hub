// src/data/sinCatalogue.ts
// Full examination of conscience catalogue — six categories, Oriental Orthodox tradition.

import type { SinItem } from './types';

export const SIN_CATALOGUE: SinItem[] = [
  // ─── Tongue ───────────────────────────────────────────────────────────────────
  {
    id: 'tongue_lying',
    category: 'tongue',
    name: 'Lying',
    description: "Telling falsehoods, even 'white lies' to protect yourself or others.",
    scripture: 'Proverbs 12:22',
  },
  {
    id: 'tongue_gossip',
    category: 'tongue',
    name: 'Gossiping',
    description: "Sharing information about others that damages their reputation, whether true or false.",
    scripture: 'Proverbs 11:13',
  },
  {
    id: 'tongue_judging',
    category: 'tongue',
    name: 'Judging others',
    description: 'Condemning another person in speech, assuming the worst about them.',
    scripture: 'Matthew 7:1',
  },
  {
    id: 'tongue_swearing',
    category: 'tongue',
    name: 'Swearing / cursing',
    description: "Using the Lord's name in vain, swearing oaths carelessly, or profane speech.",
    scripture: 'Matthew 5:34',
  },
  {
    id: 'tongue_slander',
    category: 'tongue',
    name: 'Slander',
    description: "Deliberately saying false things to damage someone's reputation.",
    scripture: 'Psalm 101:5',
  },
  {
    id: 'tongue_flattery',
    category: 'tongue',
    name: 'Flattery',
    description: 'Insincere praise given to gain favor or manipulate others.',
    scripture: 'Proverbs 26:28',
  },
  {
    id: 'tongue_idle',
    category: 'tongue',
    name: 'Idle / vain talk',
    description: 'Spending much time in conversation that bears no spiritual fruit.',
    scripture: 'Matthew 12:36',
  },
  {
    id: 'tongue_contention',
    category: 'tongue',
    name: 'Quarrelling & contention',
    description: 'Arguing and seeking to win rather than to reconcile or understand.',
    scripture: 'Proverbs 17:14',
  },
  {
    id: 'tongue_boasting',
    category: 'tongue',
    name: 'Boasting',
    description: 'Exaggerating your accomplishments or speaking proudly about yourself.',
    scripture: 'Proverbs 27:1',
  },

  // ─── Thoughts ─────────────────────────────────────────────────────────────────
  {
    id: 'thoughts_pride',
    category: 'thoughts',
    name: 'Pride',
    description: 'Exalting yourself above others; believing your gifts come from yourself alone.',
    scripture: 'Philippians 2:3',
  },
  {
    id: 'thoughts_envy',
    category: 'thoughts',
    name: 'Envy',
    description: "Resenting the blessings, gifts, or successes of others.",
    scripture: 'Galatians 5:26',
  },
  {
    id: 'thoughts_lust',
    category: 'thoughts',
    name: 'Lustful thoughts',
    description: 'Dwelling on impure, sexual fantasies about anyone outside of marriage.',
    scripture: 'Matthew 5:28',
  },
  {
    id: 'thoughts_anger',
    category: 'thoughts',
    name: 'Harboured anger',
    description: 'Holding onto anger or resentment toward another person beyond the day.',
    scripture: 'Ephesians 4:26',
  },
  {
    id: 'thoughts_greed',
    category: 'thoughts',
    name: 'Greed / covetousness',
    description: 'Longing for what belongs to others; an attachment to wealth and possessions.',
    scripture: 'Luke 12:15',
  },
  {
    id: 'thoughts_despair',
    category: 'thoughts',
    name: 'Despair & hopelessness',
    description: "Losing trust in God's mercy; dwelling in darkness rather than turning to prayer.",
    scripture: 'Lamentations 3:22-23',
  },
  {
    id: 'thoughts_vainglory',
    category: 'thoughts',
    name: 'Vainglory',
    description: "Seeking human praise, reputation, or approval more than God's.",
    scripture: 'John 5:44',
  },
  {
    id: 'thoughts_unbelief',
    category: 'thoughts',
    name: 'Doubt & unbelief',
    description: 'Entertaining thoughts that undermine faith: "Is God listening?", "Does He care?"',
    scripture: 'Hebrews 11:6',
  },
  {
    id: 'thoughts_judgment',
    category: 'thoughts',
    name: 'Judging inwardly',
    description: "Passing mental verdicts on others' behavior, holiness, or worth.",
    scripture: 'Romans 2:1',
  },

  // ─── Hearing ──────────────────────────────────────────────────────────────────
  {
    id: 'hearing_gossip',
    category: 'hearing',
    name: 'Listening to gossip',
    description: 'Willingly listening to slander or negative talk about others without stopping it.',
    scripture: 'Proverbs 17:4',
  },
  {
    id: 'hearing_bad_music',
    category: 'hearing',
    name: 'Filling ears with harmful content',
    description: 'Music, podcasts, or speech that provokes lust, anger, or worldliness.',
    scripture: 'Philippians 4:8',
  },
  {
    id: 'hearing_blasphemy',
    category: 'hearing',
    name: 'Tolerating blasphemy',
    description: "Not defending God's name or the faith when it is mocked in your presence.",
    scripture: 'Leviticus 24:15',
  },
  {
    id: 'hearing_neglect_word',
    category: 'hearing',
    name: "Neglecting to hear God's word",
    description: 'Avoiding Scripture, sermons, or spiritual instruction without cause.',
    scripture: 'James 1:22',
  },

  // ─── Eyes ─────────────────────────────────────────────────────────────────────
  {
    id: 'eyes_pornography',
    category: 'eyes',
    name: 'Viewing pornography',
    description: 'Looking at sexually explicit material intentionally.',
    scripture: 'Job 31:1',
  },
  {
    id: 'eyes_immodest',
    category: 'eyes',
    name: 'Gazing at immodest images',
    description: 'Lingering deliberately on images, advertisements, or people to provoke lust.',
    scripture: 'Matthew 5:28',
  },
  {
    id: 'eyes_violent',
    category: 'eyes',
    name: 'Consuming violent or degrading content',
    description: 'Entertainment that glorifies violence, cruelty, or human degradation.',
    scripture: 'Psalm 101:3',
  },
  {
    id: 'eyes_envy_gaze',
    category: 'eyes',
    name: 'Envious gazing',
    description: "Looking at others' possessions, appearance, or life with covetousness.",
    scripture: 'Proverbs 23:17',
  },
  {
    id: 'eyes_social_media',
    category: 'eyes',
    name: 'Excessive social media scrolling',
    description: 'Spending hours passively consuming content that feeds vanity or comparison.',
    scripture: 'Colossians 3:2',
  },

  // ─── Actions ──────────────────────────────────────────────────────────────────
  {
    id: 'actions_theft',
    category: 'actions',
    name: 'Stealing / dishonesty',
    description: 'Taking what is not yours; dishonesty in financial dealings.',
    scripture: 'Ephesians 4:28',
  },
  {
    id: 'actions_violence',
    category: 'actions',
    name: 'Physical harm or violence',
    description: 'Striking, physically hurting, or intimidating another person.',
    scripture: 'Matthew 26:52',
  },
  {
    id: 'actions_fornication',
    category: 'actions',
    name: 'Fornication / adultery',
    description: 'Any sexual act outside of holy matrimony.',
    scripture: '1 Corinthians 6:18',
  },
  {
    id: 'actions_drunkenness',
    category: 'actions',
    name: 'Drunkenness / substance abuse',
    description: 'Intoxicating yourself with alcohol, drugs, or other substances.',
    scripture: 'Ephesians 5:18',
  },
  {
    id: 'actions_gluttony',
    category: 'actions',
    name: 'Gluttony / breaking the fast',
    description: 'Eating to excess; breaking prescribed fasts without necessity.',
    scripture: 'Proverbs 23:20',
  },
  {
    id: 'actions_disobedience',
    category: 'actions',
    name: 'Disobedience to parents or clergy',
    description: 'Defying parents, your father of confession, or lawful spiritual authority.',
    scripture: 'Exodus 20:12',
  },
  {
    id: 'actions_harm_soul',
    category: 'actions',
    name: 'Scandalizing another',
    description: 'Causing a weaker brother or sister to sin through your example.',
    scripture: 'Matthew 18:6',
  },
  {
    id: 'actions_witchcraft',
    category: 'actions',
    name: 'Involvement in occult practices',
    description: 'Horoscopes, fortune-telling, magic, or any contact with occult materials.',
    scripture: 'Deuteronomy 18:10',
  },

  // ─── Neglected practices ───────────────────────────────────────────────────────
  {
    id: 'neglect_prayer',
    category: 'neglected_practices',
    name: 'Neglecting daily prayer',
    description: 'Skipping Agpeya hours or your personal prayer rule without pressing need.',
    scripture: '1 Thessalonians 5:17',
  },
  {
    id: 'neglect_fasting',
    category: 'neglected_practices',
    name: 'Breaking the fast without necessity',
    description: 'Eating meat or dairy on appointed fast days out of desire rather than need.',
    scripture: 'Matthew 6:16',
  },
  {
    id: 'neglect_communion',
    category: 'neglected_practices',
    name: 'Avoiding Holy Communion',
    description: 'Staying away from the Eucharist for extended periods without reason.',
    scripture: 'John 6:53-54',
  },
  {
    id: 'neglect_tithe',
    category: 'neglected_practices',
    name: 'Neglecting charity and almsgiving',
    description: 'Hoarding wealth while the poor are in need; failing to give generously.',
    scripture: 'Matthew 25:42',
  },
  {
    id: 'neglect_forgiveness',
    category: 'neglected_practices',
    name: 'Withholding forgiveness',
    description: 'Refusing to reconcile with someone who has wronged you.',
    scripture: 'Matthew 6:15',
  },
  {
    id: 'neglect_liturgy',
    category: 'neglected_practices',
    name: 'Skipping the Divine Liturgy',
    description: 'Deliberately missing Sunday Liturgy without sickness or genuine emergency.',
    scripture: 'Hebrews 10:25',
  },
  {
    id: 'neglect_scripture',
    category: 'neglected_practices',
    name: 'Neglecting Scripture reading',
    description: 'Going many days without opening the Bible for personal reading.',
    scripture: 'Psalm 119:105',
  },
  {
    id: 'neglect_confession_delay',
    category: 'neglected_practices',
    name: 'Delaying confession',
    description: 'Putting off confession for months despite awareness of serious sin.',
    scripture: '1 John 1:9',
  },
];

export const CATEGORY_META: Record<
  string,
  { label: string; icon: string; color: string; colorLight: string }
> = {
  tongue: {
    label:      'The Tongue',
    icon:       '🗣',
    color:      '#7A1F2B',
    colorLight: '#F7E4E2',
  },
  thoughts: {
    label:      'Thoughts',
    icon:       '💭',
    color:      '#1F4E8C',
    colorLight: '#E6EEF7',
  },
  hearing: {
    label:      'Hearing',
    icon:       '👂',
    color:      '#8A6516',
    colorLight: '#FBEFD6',
  },
  eyes: {
    label:      'The Eyes',
    icon:       '👁',
    color:      '#1D7A5C',
    colorLight: '#E3F0E8',
  },
  actions: {
    label:      'Actions',
    icon:       '🤲',
    color:      '#6A3D8F',
    colorLight: '#EEE7F5',
  },
  neglected_practices: {
    label:      'Neglected Practices',
    icon:       '📿',
    color:      '#6E6253',
    colorLight: '#F2E9D5',
  },
};
