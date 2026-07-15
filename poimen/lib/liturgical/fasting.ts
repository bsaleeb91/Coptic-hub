// lib/liturgical/fasting.ts
// Coptic fasting helpers. Wednesdays and Fridays are fasting days throughout the
// year, EXCEPT during the Holy Fifty Days (Resurrection Sunday to Pentecost),
// when no fasting is observed. Prostrations are likewise not done on Saturdays,
// Sundays, or during the Holy Fifty.

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

// Wednesdays (3) and Fridays (5) are fasting days, unless in the Holy Fifty.
export function isFastDay(date: Date): boolean {
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
