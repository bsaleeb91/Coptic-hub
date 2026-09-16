// lib/reminders/phrasing.ts
// The pure half of the reminder feature: how a time is written, how a time is
// stepped, and how a list of canon items becomes one sentence.
//
// Split out from store.ts and content.ts because those reach for AsyncStorage
// and the psalm/canon stores, and none of this needs to. A notification's text
// is the only part of the app a member reads without opening it, and it cannot
// be checked by looking at a screen — so it is tested instead.

// "8:00 PM" — how a time is written everywhere in the reminder UI.
export function formatTime(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

// Step a time by whole minutes, wrapping around midnight in both directions so
// the stepper in app/reminders.tsx never dead-ends at 12:00 AM.
export function stepTime(hour: number, minute: number, deltaMinutes: number): { hour: number; minute: number } {
  const total = (((hour * 60 + minute + deltaMinutes) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

// Canon item labels carry UI detail a notification has no room for — "Attend
// Vespers — 1 of 2 this week", "Read 3 chapters · Mon, Wed". The reminder keeps
// the verb and the name and drops the rest.
export function cleanLabel(label: string): string {
  return label.split(' — ')[0].split(' · ')[0].trim();
}

// "Pray the Sixth Hour and attend Vespers." / "…, and 3 more."
//
// Only the first label keeps its capital: the rest are folded into a sentence
// where "Attend Vespers" mid-clause would read as a title. A label that is a
// proper noun ("Agpeya", "Vespers") is left alone, which is what the
// second-character test is for.
export function describeItems(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return `${labels[0]}.`;
  if (labels.length === 2) return `${labels[0]} and ${lowerFirst(labels[1])}.`;
  return `${labels[0]}, ${lowerFirst(labels[1])}, and ${labels.length - 2} more.`;
}

function lowerFirst(s: string): string {
  if (s.length < 2) return s;
  const startsSentenceCase = s[0] === s[0].toUpperCase() && s[1] === s[1].toLowerCase();
  return startsSentenceCase ? s[0].toLowerCase() + s.slice(1) : s;
}
