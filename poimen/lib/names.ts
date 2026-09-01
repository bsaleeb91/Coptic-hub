// lib/names.ts
// Clergy-title-aware name helpers, shared across every screen that greets or
// displays a person by name. A priest often types their title as part of
// their profile's full_name at sign-up (e.g. "Fr. Mina Youssef"), so a
// leading title is stripped before picking a given name.

const NAME_TITLES = new Set(['fr.', 'fr', 'father', 'rev.', 'rev', 'abouna', 'dn.', 'dn']);

export function firstGivenName(fullName?: string | null): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  const given = parts.find(p => !NAME_TITLES.has(p.toLowerCase()));
  return given ?? parts[0] ?? '';
}

// "Fr. {first given name}" — the consistent way to display a priest's name
// anywhere in the app: their own greeting, or a congregant's view of their FOC.
export function clergyDisplayName(fullName?: string | null): string {
  const given = firstGivenName(fullName);
  return given ? `Fr. ${given}` : 'Father';
}
