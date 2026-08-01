// lib/feasts.ts
// The Coptic liturgical calendar's feasts and fast openings, computed live.
//
// Three kinds of dates:
//  · Movable feasts (Palm Sunday, Resurrection, Ascension, Pentecost) and the
//    movable fast openings derive from each year's Pascha (lib/canon/fasting).
//  · Feasts fixed in the Coptic month of Thout shift with Nayrouz: 1 Thout is
//    Sept 11, but Sept 12 in Gregorian years ≡ 3 (mod 4) — the Coptic leap day
//    lands just before those new years.
//  · The remaining fixed feasts are anchored to Julian dates, whose Gregorian
//    equivalents are constant for 1900–2099 (e.g. Nativity = Julian Dec 25 =
//    Jan 7; the Church adjusts the Koiahk date after Coptic leap years so the
//    Gregorian day never moves).

import { orthodoxPascha, churchFastsForYear } from './canon/fasting';

export interface Feast {
  date: Date;
  title: string;
  desc: string;
  kind: 'major' | 'minor' | 'commemoration' | 'fast';
}

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);
const offset = (base: Date, days: number) => {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  x.setHours(12, 0, 0, 0);
  return x;
};

// How each fasting season from lib/canon/fasting is announced on the calendar.
const FAST_OPENINGS: Record<string, { title: string; desc: string }> = {
  "Jonah's Fast":    { title: 'Fast of Nineveh begins',  desc: 'Three days of fasting recalling the repentance of Nineveh (Jonah’s Fast).' },
  'Great Lent':      { title: 'Great Lent begins',       desc: 'The Great Fast — fifty-five days of preparation ending in the Resurrection.' },
  "Apostles' Fast":  { title: 'Apostles’ Fast begins',   desc: 'The fast of the disciples, from after Pentecost until the Feast of the Apostles.' },
  "St. Mary's Fast": { title: 'St. Mary’s Fast begins',  desc: 'Fifteen days of fasting in honor of the Theotokos (1–15 Mesra).' },
  'Nativity Fast':   { title: 'Nativity Fast begins',    desc: 'Forty-three days of fasting before the Feast of the Nativity.' },
};

// Every feast and fast opening in Gregorian year `y`.
export function feastsForYear(y: number): Feast[] {
  const list: Feast[] = [
    // ── Fixed (Julian-anchored, constant Gregorian dates 1900–2099) ──
    { date: at(y, 1, 7),   kind: 'major', title: 'Feast of the Nativity', desc: 'The birth of our Lord Jesus Christ. Major Feast of the Lord — end of the Nativity Fast.' },
    { date: at(y, 1, 14),  kind: 'minor', title: 'Feast of the Circumcision', desc: 'The Circumcision of our Lord on the eighth day. Minor Feast of the Lord.' },
    { date: at(y, 1, 19),  kind: 'major', title: 'Feast of Theophany (Epiphany)', desc: 'The Baptism of our Lord in the Jordan. Liturgy of the Blessing of the Waters (Lakan).' },
    { date: at(y, 1, 21),  kind: 'minor', title: 'Wedding at Cana of Galilee', desc: 'The first miracle of our Lord — water made wine. Minor Feast of the Lord.' },
    { date: at(y, 2, 15),  kind: 'minor', title: 'Entrance of the Lord into the Temple', desc: 'The presentation of our Lord in the Temple as an infant. Minor Feast of the Lord.' },
    { date: at(y, 3, 19),  kind: 'commemoration', title: 'Feast of the Cross', desc: 'Commemoration of the apparition of the Holy Cross (10 Paremhat).' },
    { date: at(y, 4, 7),   kind: 'major', title: 'Feast of the Annunciation', desc: 'The Archangel Gabriel announces the Incarnation to the Virgin Mary (29 Paremhat).' },
    { date: at(y, 6, 1),   kind: 'minor', title: 'Entrance of the Lord into Egypt', desc: 'The flight of the Holy Family into Egypt (24 Pashons). Minor Feast of the Lord.' },
    { date: at(y, 6, 19),  kind: 'commemoration', title: 'Feast of Archangel Michael', desc: 'The annual feast of the Archangel Michael (12 Paoni).' },
    { date: at(y, 7, 12),  kind: 'commemoration', title: 'Feast of the Apostles', desc: 'Martyrdom of Sts. Peter and Paul (5 Epip). End of the Apostles’ Fast — breaking of the fast after Divine Liturgy.' },
    { date: at(y, 8, 19),  kind: 'minor', title: 'Feast of the Transfiguration', desc: 'The Transfiguration of our Lord on Mount Tabor (13 Mesra). Minor Feast of the Lord.' },
    { date: at(y, 8, 22),  kind: 'commemoration', title: 'Assumption of St. Mary', desc: 'The assumption of the body of the Theotokos (16 Mesra). End of St. Mary’s Fast.' },
  ];

  // ── Fast openings ──
  // Dates come from lib/canon/fasting (the single source of truth for fasting
  // seasons); only the wording lives here.
  for (const f of churchFastsForYear(y)) {
    const copy = FAST_OPENINGS[f.name];
    const date = new Date(f.start);
    date.setHours(12, 0, 0, 0);
    list.push({ date, kind: 'fast', title: copy.title, desc: copy.desc });
  }

  // ── Thout feasts — shift with Nayrouz ──
  const nayrouzDay = y % 4 === 3 ? 12 : 11;
  const nayrouz = at(y, 9, nayrouzDay);
  list.push(
    { date: nayrouz, kind: 'commemoration', title: 'Nayrouz — Coptic New Year', desc: `Feast of the Martyrs — Coptic year ${y - 283} begins (1 Thout).` },
    { date: offset(nayrouz, 16), kind: 'commemoration', title: 'Feast of the Cross', desc: 'Commemoration of the finding of the Holy Cross by Queen Helena (17 Thout).' },
  );

  // ── Movable — from this year's Pascha ──
  const pascha = orthodoxPascha(y);
  pascha.setHours(12, 0, 0, 0);
  list.push(
    { date: offset(pascha, -7),  kind: 'major', title: 'Palm Sunday (Hosanna)', desc: 'The entrance of our Lord into Jerusalem. Major Feast of the Lord — Holy Week begins.' },
    { date: pascha,              kind: 'major', title: 'Feast of the Resurrection', desc: 'The glorious Resurrection of our Lord Jesus Christ — the Feast of Feasts.' },
    { date: offset(pascha, 39),  kind: 'major', title: 'Feast of the Ascension', desc: 'The Ascension of our Lord into heaven, forty days after the Resurrection.' },
    { date: offset(pascha, 49),  kind: 'major', title: 'Feast of Pentecost', desc: 'The descent of the Holy Spirit upon the disciples. End of the Holy Fifty.' },
  );

  return list.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// The feast (or fast opening) falling on `date`, if any. When more than one
// lands on the same day, the most significant wins (major > minor >
// commemoration > fast).
export function feastOn(date: Date): Feast | null {
  const matches = feastsForYear(date.getFullYear()).filter(f =>
    f.date.getFullYear() === date.getFullYear() &&
    f.date.getMonth() === date.getMonth() &&
    f.date.getDate() === date.getDate(),
  );
  if (!matches.length) return null;
  const rank: Record<Feast['kind'], number> = { major: 0, minor: 1, commemoration: 2, fast: 3 };
  matches.sort((a, b) => rank[a.kind] - rank[b.kind]);
  return matches[0];
}

// The next `count` entries on or after `from` (looks across the year boundary).
export function upcomingFeasts(from: Date, count = 4): Feast[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const y = from.getFullYear();
  return [...feastsForYear(y), ...feastsForYear(y + 1)]
    .filter(f => f.date >= start)
    .slice(0, count);
}
