// lib/pastoral-secure.ts
// Sealing and opening the contact / family payloads.
//
// The shape callers see is unchanged from when these were plain columns:
// ContactData and ChildData have exactly the fields the profile and priest
// screens already render. Only how they are stored changed.
//
// Two readers, so two seals (the prayer-body pattern):
//   payload_self   the member, who edits their own details
//   payload_foc    their Father of Confession, the intended reader
//
// A seal names the profile it was made for (payload_foc_for), because a member
// can change Father of Confession. Without it we could not tell a payload
// sealed to the current priest from one sealed to the previous priest — both
// are opaque strings — and the new priest would silently see nothing.
//
// Reading falls back to the plaintext columns while the backfill drains, so a
// member who has not opened the app since the migration still renders.

import { encryptForSelf, encryptForRecipient, decryptSelf, decryptFromSender } from '@/lib/crypto';
import { classifyCiphertext } from '@/lib/crypto-format';
import { legacyContact, legacyChild, byBirthYear, needsSealing } from '@/lib/pastoral-shape';
import type { ContactData, ChildData, OpenedChild, Row } from '@/lib/pastoral-shape';

// Re-exported so callers have one import for the whole contact/family surface.
export { needsSealing, CLEARED_CONTACT_COLUMNS, CLEARED_CHILD_COLUMNS } from '@/lib/pastoral-shape';
export type { ContactData, ChildData, OpenedChild } from '@/lib/pastoral-shape';

export interface SealedPayload {
  payload_self: string;
  payload_foc: string | null;
  payload_foc_for: string | null;
}

// Seal `data` for the member and, when we have one, for their FOC.
//
// A missing FOC public key is not an error: the member may have no FOC, or
// their priest may not have finished key setup. The row is still sealed to the
// member, payload_foc stays null, and the reseal path below picks it up once
// the key exists. What must never happen is writing the row unsealed.
export async function seal<T>(
  data: T,
  foc: { id: string; publicKey: string | null } | null,
): Promise<SealedPayload> {
  const json = JSON.stringify(data);
  return {
    payload_self: await encryptForSelf(json),
    payload_foc: foc?.publicKey ? await encryptForRecipient(json, foc.publicKey) : null,
    payload_foc_for: foc?.publicKey ? foc.id : null,
  };
}

// Open a payload we sealed ourselves.
async function openSelf<T>(payload: string | null | undefined): Promise<T | null> {
  if (!payload || classifyCiphertext(payload) !== 'box') return null;
  try { return JSON.parse(await decryptSelf(payload)) as T; } catch { return null; }
}

// Open a payload the member sealed for us (the FOC).
async function openFrom<T>(payload: string | null | undefined, memberPublicKey: string | null): Promise<T | null> {
  if (!payload || !memberPublicKey || classifyCiphertext(payload) !== 'box') return null;
  try { return JSON.parse(await decryptFromSender(payload, memberPublicKey)) as T; } catch { return null; }
}

// ── Contacts ─────────────────────────────────────────────────

// The member reading their own contact details.
export async function openContactSelf(row: Row | null): Promise<ContactData | null> {
  if (!row) return null;
  return (await openSelf<ContactData>(row.payload_self as string)) ?? legacyContact(row);
}

// The FOC reading a member's contact details. `memberPublicKey` comes from the
// member's profile; without it only the legacy columns can be read.
export async function openContactForFoc(
  row: Row | null,
  memberPublicKey: string | null,
): Promise<ContactData | null> {
  if (!row) return null;
  return (await openFrom<ContactData>(row.payload_foc as string, memberPublicKey)) ?? legacyContact(row);
}

// ── Children ─────────────────────────────────────────────────

// Open one child row, whichever reader we are. Rows that open to nothing are
// dropped by the callers below rather than rendered as blanks.
async function openChild(
  row: Row,
  memberPublicKey: string | null | undefined,
): Promise<ChildData | null> {
  const sealed = memberPublicKey === undefined
    ? await openSelf<ChildData>(row.payload_self as string)
    : await openFrom<ChildData>(row.payload_foc as string, memberPublicKey ?? null);
  return sealed ?? legacyChild(row);
}

async function openChildren(
  rows: Row[],
  memberPublicKey: string | null | undefined,
): Promise<OpenedChild[]> {
  const opened = await Promise.all(rows.map(async (row) => {
    const data = await openChild(row, memberPublicKey);
    return data ? { id: String(row.id), ...data } : null;
  }));
  return opened.filter((c): c is OpenedChild => c !== null).sort(byBirthYear);
}

export const openChildrenSelf = (rows: Row[]) => openChildren(rows, undefined);

export const openChildrenForFoc = (rows: Row[], memberPublicKey: string | null) =>
  openChildren(rows, memberPublicKey);

