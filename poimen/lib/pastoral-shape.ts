// lib/pastoral-shape.ts
// The decisions around the sealed contact / family payloads that do not need a
// key: what a legacy row contains, whether a row still needs sealing, and what
// order children come back in.
//
// Imports NOTHING, so the test runner can load it directly — the same
// constraint lib/canon/vitals.ts is written under. (An extensionless import
// breaks node's ESM loader; adding the extension makes tsc reject the source
// file. Not importing is the way out, which is why the prefix check below is
// inlined rather than borrowed from crypto-format.)

// Mirrors BOX_PREFIX in lib/crypto-format.ts. Keep the two in step.
const BOX_PREFIX = 'box1:';
const isSealed = (v: unknown): boolean => typeof v === 'string' && v.startsWith(BOX_PREFIX);

export interface ContactData {
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export interface ChildData {
  name: string | null;
  birth_year: number | null;
}

export interface OpenedChild extends ChildData { id: string; }

export type Row = Record<string, unknown>;

// Every plaintext column, explicitly nulled — the PHASE 2 cutover.
//
// Deliberately unused for now: phase 1 dual-writes the plaintext so build 17
// keeps working (see the header of 20260913020000_encrypt_pastoral_contacts).
// These name exactly what phase 2 has to clear, so they stay here rather than
// being rediscovered later.
export const CLEARED_CONTACT_COLUMNS = {
  phone: null, email: null, address_line1: null, address_line2: null,
  city: null, state: null, zip: null, country: null,
} as const;

export const CLEARED_CHILD_COLUMNS = { name: null, birth_year: null } as const;

// Read the pre-encryption plaintext columns off a row. Used only while the
// backfill drains — a member who has not opened the app since the migration.
export function legacyContact(row: Row | null): ContactData | null {
  if (!row) return null;
  const get = (k: keyof ContactData) => (typeof row[k] === 'string' && row[k] ? (row[k] as string) : null);
  const data: ContactData = {
    phone: get('phone'), email: get('email'),
    address_line1: get('address_line1'), address_line2: get('address_line2'),
    city: get('city'), state: get('state'), zip: get('zip'), country: get('country'),
  };
  // `country` defaults to 'US' at the column level, so a row carrying nothing
  // but that default is an empty row, not contact information.
  const meaningful = (Object.keys(data) as (keyof ContactData)[])
    .some(k => k !== 'country' && data[k]);
  return meaningful ? data : null;
}

export function legacyChild(row: Row): ChildData | null {
  const name = typeof row.name === 'string' && row.name ? row.name : null;
  const birthYear = typeof row.birth_year === 'number' ? row.birth_year : null;
  return name || birthYear !== null ? { name, birth_year: birthYear } : null;
}

// Children used to be ordered by the database. birth_year now lives inside the
// payload, so the order is restored after opening. Unknown years sort last
// rather than sorting as year zero.
export function byBirthYear(a: OpenedChild, b: OpenedChild): number {
  if (a.birth_year === b.birth_year) return 0;
  if (a.birth_year === null) return 1;
  if (b.birth_year === null) return -1;
  return a.birth_year - b.birth_year;
}

// True when a row still needs sealing, or was sealed to a priest who is no
// longer this member's Father of Confession.
//
// The stale case is the one worth being careful about: both payloads are
// opaque strings, so without recording who a payload was sealed for there is
// no way to tell a current seal from one belonging to the previous priest —
// and the new priest would silently see nothing at all.
export function needsSealing(row: Row | null, focId: string | null): boolean {
  if (!row) return false;
  if (!isSealed(row.payload_self)) return true;
  if (!focId) return false;
  return row.payload_foc_for !== focId;
}
