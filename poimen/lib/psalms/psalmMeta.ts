// lib/psalms/psalmMeta.ts
// A primary "type" for each Psalm so the user knows its character — repentance,
// praise, thanksgiving, etc. Uses LXX (Septuagint) numbering to match the
// Agpeya text and Orthodox liturgical usage. Classifications are approximate,
// following the broad consensus of the psalm genres.

export type PsalmCategory =
  | 'repentance'
  | 'praise'
  | 'thanksgiving'
  | 'trust'
  | 'supplication'
  | 'wisdom'
  | 'messianic'
  | 'ascents';

export interface CategoryMeta {
  label: string;
  color: string;
  blurb: string;
}

// Tag colors chosen to read against Poimen's navy background.
export const CATEGORY_META: Record<PsalmCategory, CategoryMeta> = {
  repentance:   { label: 'Repentance',      color: '#e08585', blurb: 'Penitential — sorrow for sin and a plea for mercy.' },
  praise:       { label: 'Praise',          color: '#e2c97e', blurb: 'Glorifying God for who He is.' },
  thanksgiving: { label: 'Thanksgiving',    color: '#5dca87', blurb: 'Gratitude for God’s deliverance and gifts.' },
  trust:        { label: 'Trust',           color: '#7fc4e8', blurb: 'Confidence and refuge in God.' },
  supplication: { label: 'Supplication',    color: '#c9a0dc', blurb: 'Lament and prayer for help.' },
  wisdom:       { label: 'Wisdom',          color: '#d4b36a', blurb: 'The way of the righteous and the law of God.' },
  messianic:    { label: 'Messianic',       color: '#e8a97b', blurb: 'Royal psalms pointing to Christ the King.' },
  ascents:      { label: 'Song of Ascents', color: '#6eccc4', blurb: 'Sung by pilgrims going up to the Lord.' },
};

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Priority order — first match wins (LXX numbering).
const SETS: [PsalmCategory, number[]][] = [
  ['repentance',   [6, 31, 37, 50, 101, 129, 142]],
  ['ascents',      range(119, 133)],
  ['messianic',    [2, 17, 19, 20, 44, 71, 88, 109, 131, 143]],
  ['wisdom',       [1, 36, 48, 72, 111, 118, 126, 127, 138]],
  ['thanksgiving', [29, 32, 33, 65, 66, 91, 95, 96, 99, 106, 114, 137]],
  ['praise',       [8, 18, 28, 46, 67, 76, 80, 92, 97, 98, 102, 103, 104, 110, 112, 113, 116, 117, 134, 135, 144, 145, 146, 147, 148, 149, 150]],
  ['trust',        [3, 4, 10, 15, 22, 26, 53, 61, 62, 90, 120, 123, 124, 130]],
];

const CLASSIFICATION: Record<number, PsalmCategory> = {};
for (const [cat, nums] of SETS) {
  for (const n of nums) {
    if (!(n in CLASSIFICATION)) CLASSIFICATION[n] = cat;
  }
}

export function classify(psalm: number): PsalmCategory {
  return CLASSIFICATION[psalm] ?? 'supplication';
}
