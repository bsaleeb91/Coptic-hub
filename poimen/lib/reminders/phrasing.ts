// lib/reminders/phrasing.ts
// The pure half of the reminder feature: how a list of canon items becomes one
// sentence.
//
// Split out from content.ts because that reaches for the psalm and canon
// stores and none of this needs to. A notification's text is the only part of
// the app a member reads without opening it, and it cannot be checked by
// looking at a screen — so it is tested instead.
//
// The time formatting and stepping helpers that used to live here went with
// the hand-rolled ‹ › stepper they existed for: the reminder screen now uses
// the app's own ScrollPicker and formatMinute, the same control and the same
// labels as the priest's availability windows.

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
