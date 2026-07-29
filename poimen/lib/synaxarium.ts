// lib/synaxarium.ts
// Upcoming saints' commemorations from the Coptic Synaxarium, computed live.
// Entries are defined by their COPTIC dates and converted to Gregorian by day
// arithmetic from Nayrouz (1 Thout = Sep 11, or Sep 12 in Gregorian years
// ≡ 3 mod 4). Because Coptic dates are Julian-locked and Gregorian and Julian
// leap days coincide for 1900–2099, plain day arithmetic from the correct
// Nayrouz stays accurate across the whole range — including the one-day shift
// that Sept–Feb dates carry after a Coptic leap year.

export interface Commemoration {
  date: Date;
  title: string;
  desc: string;
}

export const COPTIC_MONTHS = [
  'Thout', 'Paopi', 'Hathor', 'Koiahk', 'Tobi', 'Amshir',
  'Paremhat', 'Parmoute', 'Pashons', 'Paoni', 'Epip', 'Mesra', 'Nasie',
];

// Nayrouz (1 Thout) of the Coptic year that begins in Gregorian year `y`.
function nayrouz(y: number): Date {
  return new Date(y, 8, y % 4 === 3 ? 12 : 11, 12, 0, 0);
}

export interface CopticDate {
  year: number;       // Anno Martyrum (year of the Martyrs)
  month: number;      // 1-based (13 = Nasie, the epagomenal days)
  day: number;        // 1-based
  monthName: string;
}

// Convert a Gregorian date to its Coptic (Anno Martyrum) date by day arithmetic
// from the preceding Nayrouz. Twelve 30-day months plus the 5–6 epagomenal days
// of Nasie; accurate for 1900–2099 (Julian/Gregorian leap days coincide).
export function gregorianToCoptic(g: Date): CopticDate {
  const noon = new Date(g.getFullYear(), g.getMonth(), g.getDate(), 12, 0, 0);
  let y = g.getFullYear();
  let ny = nayrouz(y);
  if (noon < ny) { y -= 1; ny = nayrouz(y); }   // still in last Coptic year
  const dayDiff = Math.round((noon.getTime() - ny.getTime()) / 86400000);
  const month = Math.floor(dayDiff / 30) + 1;
  const day = (dayDiff % 30) + 1;
  return { year: y - 283, month, day, monthName: COPTIC_MONTHS[month - 1] };
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// The Synaxarium commemoration falling on `date`, if any (searches the two
// Coptic years that can overlap a Gregorian date). Returns the first match.
export function commemorationOn(date: Date): Commemoration | null {
  const y = date.getFullYear();
  const all = [...commemorationsForCopticYear(y - 1), ...commemorationsForCopticYear(y)];
  return all.find(c => sameDay(c.date, date)) ?? null;
}

// Gregorian date of Coptic month `m` (1-based), day `d`, for the Coptic year
// beginning in Gregorian year `nayrouzYear`.
export function copticToGregorian(nayrouzYear: number, m: number, d: number): Date {
  const date = nayrouz(nayrouzYear);
  date.setDate(date.getDate() + (m - 1) * 30 + (d - 1));
  return date;
}

// Annual commemorations — Coptic month/day per the Synaxarium.
const SAINTS: { m: number; d: number; title: string; desc: string }[] = [
  { m: 1,  d: 2,  title: 'Beheading of St. John the Baptist',   desc: 'Martyrdom of the Forerunner and Baptist John (2 Thout).' },
  { m: 2,  d: 22, title: 'St. Luke the Evangelist',             desc: 'Martyrdom of St. Luke, evangelist and physician (22 Paopi).' },
  { m: 3,  d: 8,  title: 'The Four Incorporeal Creatures',      desc: 'Feast of the Four Incorporeal Living Creatures around the throne (8 Hathor).' },
  { m: 3,  d: 15, title: 'St. Mina the Wonderworker',           desc: 'Martyrdom of St. Mina of Mariout (15 Hathor).' },
  { m: 3,  d: 25, title: 'St. Philopateer Mercurius',           desc: 'Martyrdom of Abu Seifein, "the bearer of two swords" (25 Hathor).' },
  { m: 4,  d: 3,  title: 'Entrance of St. Mary into the Temple', desc: 'The Theotokos presented in the Temple as a child (3 Koiahk).' },
  { m: 4,  d: 8,  title: 'St. Barbara the Martyr',              desc: 'Martyrdom of St. Barbara (8 Koiahk).' },
  { m: 4,  d: 10, title: 'St. Nicholas of Myra',                desc: 'Commemoration of St. Nicholas the Wonderworker (10 Koiahk).' },
  { m: 4,  d: 22, title: 'Archangel Gabriel',                   desc: 'Feast of the Archangel Gabriel, the announcer of the Incarnation (22 Koiahk).' },
  { m: 5,  d: 1,  title: 'St. Stephen the Archdeacon',          desc: 'The first martyr of Christianity (1 Tobi).' },
  { m: 5,  d: 13, title: 'St. Demiana and the Forty Virgins',   desc: 'Martyrdom of St. Demiana and her companions (13 Tobi).' },
  { m: 5,  d: 22, title: 'St. Anthony the Great',               desc: 'Departure of the father of monasticism (22 Tobi).' },
  { m: 6,  d: 2,  title: 'St. Paul the First Hermit',           desc: 'Departure of Anba Bola, the first anchorite (2 Amshir).' },
  { m: 6,  d: 30, title: 'Pope Kyrillos VI',                    desc: 'Departure of Pope Kyrillos VI, the wonderworker (30 Amshir).' },
  { m: 7,  d: 8,  title: 'Pope Shenouda III',                   desc: 'Departure of Pope Shenouda III, teacher of generations (8 Paremhat).' },
  { m: 7,  d: 24, title: 'Apparition of St. Mary at Zeitoun',   desc: 'The apparitions of the Theotokos at Zeitoun, Cairo, 1968 (24 Paremhat).' },
  { m: 7,  d: 27, title: 'St. Macarius the Great',              desc: 'Departure of Abba Macarius, father of the monks of Scetis (27 Paremhat).' },
  { m: 8,  d: 23, title: 'St. George the Prince of Martyrs',    desc: 'Martyrdom of Mar Girgis (23 Parmoute).' },
  { m: 8,  d: 30, title: 'St. Mark the Evangelist',             desc: 'Martyrdom of St. Mark, apostle of Egypt and beholder of God (30 Parmoute).' },
  { m: 9,  d: 1,  title: 'Nativity of St. Mary',                desc: 'The birth of the Theotokos (1 Pashons).' },
  { m: 9,  d: 7,  title: 'St. Athanasius the Apostolic',        desc: 'Departure of the 20th Pope, defender of the faith (7 Pashons).' },
  { m: 9,  d: 14, title: 'St. Pachomius',                       desc: 'Departure of the father of communal monasticism (14 Pashons).' },
  { m: 10, d: 24, title: 'St. Moses the Strong',                desc: 'Martyrdom of St. Moses the Black (24 Paoni).' },
  { m: 11, d: 7,  title: 'St. Shenouda the Archimandrite',      desc: 'Departure of the great abbot of the White Monastery (7 Epip).' },
  { m: 11, d: 8,  title: 'St. Bishoy',                          desc: 'Departure of Anba Bishoy, the beloved of our good Savior (8 Epip).' },
  { m: 11, d: 23, title: 'St. Marina the Martyr',               desc: 'Martyrdom of St. Marina (23 Epip).' },
  { m: 11, d: 24, title: 'St. Abanoub',                         desc: 'Martyrdom of the child martyr St. Abanoub of Nehisa (24 Epip).' },
  { m: 12, d: 15, title: 'Archdeacon Habib Girgis',             desc: 'Departure of St. Habib Girgis, founder of the Sunday School movement (15 Mesra).' },
  { m: 12, d: 24, title: 'St. Takla Haymanot',                  desc: 'Departure of the Ethiopian saint Takla Haymanot (24 Mesra).' },
];

// All commemorations of the Coptic year beginning in `nayrouzYear`: the annual
// Synaxarium entries above plus the monthly commemorations of Archangel
// Michael (12th) and the Theotokos (21st). 21 Tobi is her Dormition; 12 Paoni
// is Michael's annual feast (listed with the feasts, so skipped here).
function commemorationsForCopticYear(nayrouzYear: number): Commemoration[] {
  const list: Commemoration[] = SAINTS.map(s => ({
    date: copticToGregorian(nayrouzYear, s.m, s.d),
    title: s.title,
    desc: s.desc,
  }));
  for (let m = 1; m <= 12; m++) {
    if (m !== 10) {
      list.push({
        date: copticToGregorian(nayrouzYear, m, 12),
        title: 'Archangel Michael',
        desc: `Monthly commemoration (12 ${COPTIC_MONTHS[m - 1]}).`,
      });
    }
    if (m === 5) {
      list.push({
        date: copticToGregorian(nayrouzYear, m, 21),
        title: 'Dormition of St. Mary',
        desc: 'The falling-asleep of the Theotokos (21 Tobi).',
      });
    } else {
      list.push({
        date: copticToGregorian(nayrouzYear, m, 21),
        title: 'St. Mary the Theotokos',
        desc: `Monthly commemoration (21 ${COPTIC_MONTHS[m - 1]}).`,
      });
    }
  }
  return list.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// The next `count` commemorations on or after `from`.
export function upcomingCommemorations(from: Date, count = 4): Commemoration[] {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  // The Coptic year that began last September plus the next two cover any
  // window that starts today.
  const base = from.getMonth() >= 8 ? from.getFullYear() : from.getFullYear() - 1;
  return [
    ...commemorationsForCopticYear(base),
    ...commemorationsForCopticYear(base + 1),
    ...commemorationsForCopticYear(base + 2),
  ]
    .filter(c => c.date >= start)
    .slice(0, count);
}
