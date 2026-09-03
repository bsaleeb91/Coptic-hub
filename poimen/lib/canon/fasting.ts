// lib/canon/fasting.ts
// Coptic fasting helpers (ported from Nepsis). Wednesdays and Fridays are fasting
// days throughout the year, EXCEPT during the Holy Fifty Days (Resurrection
// Sunday to Pentecost), when no fasting is observed. Prostrations are likewise
// not done on Saturdays, Sundays, or during the Holy Fifty.

// Orthodox Pascha (Resurrection Sunday) as a Gregorian date. Meeus's Julian
// computus + the Julian→Gregorian offset (13 days, valid 1900–2099).
export function orthodoxPascha(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = March, 4 = April
  const day = ((d + e + 114) % 31) + 1;
  const julian = new Date(year, month - 1, day);
  julian.setDate(julian.getDate() + 13); // Julian → Gregorian
  return julian;
}

const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// The Holy Fifty: Resurrection Sunday through Pentecost (50 days, fast-free).
export function isHolyFifty(date: Date): boolean {
  const pascha = orthodoxPascha(date.getFullYear());
  const start = dayOnly(pascha);
  const end = dayOnly(pascha);
  end.setDate(end.getDate() + 49); // Pentecost = the 50th day
  const d = dayOnly(date);
  return d >= start && d <= end;
}

export interface FastSeason { title: string; start: Date; end: Date; }

// The Church's multi-day fasting seasons, as dated ranges. Paramoun days are
// not included. The movable fasts (Jonah, Great Lent, Apostles') are recomputed
// for each year from that year's Pascha, so they land on different Gregorian
// dates every year. Nativity and St. Mary's are fixed in the Coptic calendar
// (Hatour 16–Koiahk 28 and Mesra 1–15); their Gregorian equivalents are stable
// for 1900–2099, which this app treats as fixed ranges.
//
// This list is the single source of truth for "are we fasting" AND for "which
// day of it is this" — the dashboard's date line used to carry its own copy of
// these ranges and had drifted (St. Mary's as Aug 1–14, so its day number ran a
// week ahead of the fast that the feasts list correctly announced for Aug 7).
export function fastSeasons(y: number): FastSeason[] {
  const pascha = dayOnly(orthodoxPascha(y));
  const off = (n: number) => { const x = new Date(pascha); x.setDate(x.getDate() + n); return x; };
  return [
    // Jonah's Fast (Nineveh): Mon–Wed, 69–67 days before Pascha
    { title: 'Fast of Nineveh', start: off(-69), end: off(-67) },
    // Great Lent + Holy Week: 55 days before Pascha through Holy Saturday
    { title: 'Great Lent', start: off(-55), end: off(-1) },
    // Apostles' Fast: day after Pentecost through Jul 11 (feast Jul 12)
    { title: 'Apostles’ Fast', start: off(50), end: new Date(y, 6, 11) },
    // St. Mary's Fast: Mesra 1–15 = Aug 7–21 (feast Aug 22)
    { title: 'St. Mary’s Fast', start: new Date(y, 7, 7), end: new Date(y, 7, 21) },
    // Nativity Fast: Nov 25 – Jan 6 of the FOLLOWING year (feast Jan 7)
    { title: 'Nativity Fast', start: new Date(y, 10, 25), end: new Date(y + 1, 0, 6) },
  ];
}

// The fasting season `date` falls in, and how far into it we are (day 1 is the
// first day). Seasons from the previous year are considered too, because the
// Nativity Fast runs across the new year.
export function currentFastSeason(date: Date): { title: string; day: number; length: number } | null {
  const d = dayOnly(date);
  const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
  const y = d.getFullYear();
  for (const s of [...fastSeasons(y - 1), ...fastSeasons(y)]) {
    if (d >= s.start && d <= s.end) {
      return { title: s.title, day: days(s.start, d) + 1, length: days(s.start, s.end) + 1 };
    }
  }
  return null;
}

export function isChurchFast(date: Date): boolean {
  return currentFastSeason(date) !== null;
}

// Fasting days: every day of a church fasting season, plus Wednesdays (3) and
// Fridays (5) year-round — except during the Holy Fifty.
export function isFastDay(date: Date): boolean {
  if (isChurchFast(date)) return true;
  const wd = date.getDay();
  if (wd !== 3 && wd !== 5) return false;
  return !isHolyFifty(date);
}

// Days the appointed-hour abstinence is kept — going without food until the
// hour set in the rule. Never a Saturday or a Sunday: the Church does not fast
// in that sense on the Sabbath or the Lord's Day. Those days remain fast days
// inside a season (isFastDay stays true, and its food restrictions stand) —
// what lifts is the delaying of the meal. Wednesdays and Fridays can never fall
// on a weekend, so this only ever relaxes a season.
export function isAbstinenceDay(date: Date): boolean {
  const wd = date.getDay();
  if (wd === 0 || wd === 6) return false;
  return isFastDay(date);
}

// Prostrations are not done on Saturdays, Sundays, or during the Holy Fifty.
export function prostrationsAllowed(date: Date): boolean {
  const wd = date.getDay();
  if (wd === 0 || wd === 6) return false;
  return !isHolyFifty(date);
}
