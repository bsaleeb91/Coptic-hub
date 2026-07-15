// lib/liturgical/season.ts
// Human-readable liturgical day context: the current fast season with its day
// count, or the weekly Wed/Fri fast, or the fast-free Holy Fifty. The Apostles'
// Fast start is computed from Pascha (Monday after Pentecost) so it is correct
// every year, not just the year it was written.

import { orthodoxPascha, isFastDay, isHolyFifty } from './fasting';

const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) =>
  Math.round((dayOnly(b).getTime() - dayOnly(a).getTime()) / 86400000);

// The current long fast (with day count), if any.
export function fastSeason(date: Date): string | null {
  const y = date.getFullYear();
  const d = dayOnly(date);

  // Apostles' Fast: Monday after Pentecost (Pascha + 50) through July 11,
  // ending with the Feast of the Apostles on Epip 5 (July 12).
  const pascha = orthodoxPascha(y);
  const apostlesStart = dayOnly(pascha);
  apostlesStart.setDate(apostlesStart.getDate() + 50);
  const apostlesEnd = new Date(y, 6, 11);
  if (d >= apostlesStart && d <= apostlesEnd) {
    return `Apostles' Fast · Day ${daysBetween(apostlesStart, d) + 1}`;
  }

  // St. Mary's Fast: Aug 1–14 (Mesori), ending with the Feast of the Assumption.
  const m = date.getMonth() + 1, dd = date.getDate();
  if (m === 8 && dd >= 1 && dd <= 14) return `St. Mary's Fast · Day ${dd}`;

  // Advent (Nativity) Fast: Nov 25 – Jan 6.
  if ((m === 11 && dd >= 25) || m === 12 || (m === 1 && dd <= 6)) {
    const startYear = m === 1 ? y - 1 : y;
    const start = new Date(startYear, 10, 25);
    return `Advent Fast · Day ${daysBetween(start, d) + 1}`;
  }

  // Great Lent: the 55 days before Pascha (8 weeks: preparation + 40 days + Holy Week).
  const lentStart = dayOnly(pascha);
  lentStart.setDate(lentStart.getDate() - 55);
  if (d >= lentStart && d < dayOnly(pascha)) {
    return `Great Lent · Day ${daysBetween(lentStart, d) + 1}`;
  }

  return null;
}

// One-line liturgical context for the day, e.g.
//   "Apostles' Fast · Day 12"  |  "Fasting day"  |  "Holy Fifty — fast-free"  |  null
export function dayContext(date: Date): string | null {
  const season = fastSeason(date);
  if (season) return season;
  if (isHolyFifty(date)) return 'Holy Fifty — fast-free';
  if (isFastDay(date)) return 'Fasting day';
  return null;
}
