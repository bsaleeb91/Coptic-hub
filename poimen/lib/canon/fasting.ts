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

// The Church's multi-day fasting seasons. Paramoun days are not included.
// The movable fasts (Jonah, Great Lent, Apostles') are recomputed for each
// year from that year's Pascha, so they land on different Gregorian dates
// every year. Nativity and St. Mary's are fixed in the Coptic calendar
// (Hatour 16–Koiahk 28 and Mesra 1–15); their Gregorian equivalents are
// stable for 1900–2099, which this app treats as fixed ranges.
export function isChurchFast(date: Date): boolean {
  const d = dayOnly(date);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  // Nativity Fast: Nov 25 – Jan 6 (feast Jan 7)
  if ((m === 11 && day >= 25) || m === 12 || (m === 1 && day <= 6)) return true;
  // St. Mary's Fast: Mesra 1–15 = Aug 7–21 (feast Aug 22)
  if (m === 8 && day >= 7 && day <= 21) return true;

  const pascha = dayOnly(orthodoxPascha(y));
  const off = (n: number) => { const x = new Date(pascha); x.setDate(x.getDate() + n); return x; };
  const between = (a: Date, b: Date) => d >= a && d <= b;

  // Jonah's Fast (Nineveh): Mon–Wed, 69–67 days before Pascha
  if (between(off(-69), off(-67))) return true;
  // Great Lent + Holy Week: 55 days before Pascha through Holy Saturday
  if (between(off(-55), off(-1))) return true;
  // Apostles' Fast: day after Pentecost through Jul 11 (feast Jul 12)
  if (between(off(50), new Date(y, 6, 11))) return true;

  return false;
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
