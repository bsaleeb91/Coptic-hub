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

// A multi-day fasting season, as a closed range of whole days.
export interface FastPeriod {
  name: string;
  start: Date;  // first fasting day
  end: Date;    // last fasting day, inclusive
}

// A fasting season plus where `date` sits inside it.
export interface CurrentFast extends FastPeriod {
  day: number;     // 1-based day within the fast
  length: number;  // total days in the fast
}

// THE definition of the Church's multi-day fasting seasons — every caller that
// needs a fast's dates, name, or day number must go through this. Paramoun days
// are not included.
//
// The movable fasts (Jonah, Great Lent, Apostles') are recomputed for each year
// from that year's Pascha, so they land on different Gregorian dates every year.
// Nativity and St. Mary's are fixed in the Coptic calendar (Hatour 16–Koiahk 28
// and Mesra 1–15); their Gregorian equivalents are stable for 1900–2099, which
// this app treats as fixed ranges.
//
// Returns the seasons that BEGIN in Gregorian year `y` — the Nativity Fast runs
// past New Year, so it ends in y+1.
export function churchFastsForYear(y: number): FastPeriod[] {
  const pascha = dayOnly(orthodoxPascha(y));
  const off = (n: number) => { const x = new Date(pascha); x.setDate(x.getDate() + n); return x; };
  return [
    // Jonah's Fast (Nineveh): Mon–Wed, 69–67 days before Pascha
    { name: "Jonah's Fast",    start: off(-69),             end: off(-67) },
    // Great Lent + Holy Week: 55 days before Pascha through Holy Saturday
    { name: 'Great Lent',      start: off(-55),             end: off(-1) },
    // Apostles' Fast: day after Pentecost through Jul 11 (feast Jul 12)
    { name: "Apostles' Fast",  start: off(50),              end: new Date(y, 6, 11) },
    // St. Mary's Fast: Mesra 1–15 = Aug 7–21 (feast Aug 22)
    { name: "St. Mary's Fast", start: new Date(y, 7, 7),    end: new Date(y, 7, 21) },
    // Nativity Fast: Nov 25 – Jan 6 (feast Jan 7)
    { name: 'Nativity Fast',   start: new Date(y, 10, 25),  end: new Date(y + 1, 0, 6) },
  ];
}

// The fasting season `date` falls in, with its 1-based day number, or null.
export function currentFast(date: Date): CurrentFast | null {
  const d = dayOnly(date);
  const y = d.getFullYear();
  const span = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
  // Last year's list too: the Nativity Fast runs into January.
  for (const f of [...churchFastsForYear(y - 1), ...churchFastsForYear(y)]) {
    if (d >= f.start && d <= f.end) {
      return { ...f, day: span(f.start, d) + 1, length: span(f.start, f.end) + 1 };
    }
  }
  return null;
}

export function isChurchFast(date: Date): boolean {
  return currentFast(date) !== null;
}

// Fasting days: every day of a church fasting season, plus Wednesdays (3) and
// Fridays (5) year-round — except during the Holy Fifty.
export function isFastDay(date: Date): boolean {
  if (isChurchFast(date)) return true;
  const wd = date.getDay();
  if (wd !== 3 && wd !== 5) return false;
  return !isHolyFifty(date);
}

// Prostrations are not done on Saturdays, Sundays, or during the Holy Fifty.
export function prostrationsAllowed(date: Date): boolean {
  const wd = date.getDay();
  if (wd === 0 || wd === 6) return false;
  return !isHolyFifty(date);
}
