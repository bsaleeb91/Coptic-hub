// lib/liturgical/copticDate.ts
// Offline Gregorian → Coptic calendar conversion via Julian Day Number.
// Verified: 2026-06-24 → Paoni 17, A.M. 1742.

const COPTIC_MONTHS = [
  'Thout', 'Paopi', 'Hathor', 'Koiak', 'Tobi', 'Meshir', 'Paremhat',
  'Parmouti', 'Pashons', 'Paoni', 'Epip', 'Mesori', 'Nasie',
];

// JDN of Coptic 1 Thout, year 1 (Anno Martyrum) = 29 Aug 284 AD (Julian).
const COPTIC_EPOCH_JDN = 1825030;

function gregorianToJDN(year: number, month: number, day: number): number {
  const a  = Math.floor((14 - month) / 12);
  const y  = year + 4800 - a;
  const m  = month + 12 * a - 3;
  return day
    + Math.floor((153 * m + 2) / 5)
    + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)
    - 32045;
}

export interface CopticDate {
  monthName: string;
  day: number;
  year: number;
  label: string;   // "Paoni 17"
}

export function toCoptic(date: Date): CopticDate {
  const jdn = gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const n    = jdn - COPTIC_EPOCH_JDN;             // 0-based days since epoch
  const year = Math.floor((4 * n + 3) / 1461) + 1;
  const doy  = n - Math.floor((1461 * (year - 1)) / 4); // 0-based day of year
  const monthIndex = Math.floor(doy / 30);
  const day  = (doy % 30) + 1;
  const monthName = COPTIC_MONTHS[monthIndex] ?? '';
  return { monthName, day, year, label: `${monthName} ${day}` };
}

export function copticToday(): CopticDate {
  return toCoptic(new Date());
}
