-- ============================================================
-- Migration: encrypt contact and family PII — 2026-09-13
--
-- pastoral_contacts (phone, contact email, full home address) and
-- pastoral_children (a minor's first name and birth year) were the
-- largest plaintext PII surface in the app: readable by anyone with
-- database access, and undisclosed in the privacy policy until today.
--
-- They move to the same sealed-payload scheme prayer request bodies
-- already use — the whole row is serialized to JSON and sealed twice
-- with nacl.box:
--
--   payload_self     sealed to the member, so they can edit their own
--   payload_foc      sealed to their Father of Confession, who is the
--                    intended reader (visitation details are collected
--                    FOR the priest — encrypting them away from him
--                    would delete the feature, not protect it)
--   payload_foc_for  which profile payload_foc was sealed to, so the
--                    client can tell a stale seal from a current one
--                    and re-seal after the member switches FOC
--
-- Sealing can only happen on the member's device — the server never
-- holds a private key — so this migration only ADDS the columns. The
-- client seals existing rows when the member next opens their profile
-- and nulls the plaintext columns in the same write (see
-- migrateContactToSealed / migrateChildrenToSealed).
--
-- ROLLOUT IS IN TWO PHASES, because build 17 is live on the App Store,
-- has no force-update, and reads ONLY the plaintext columns.
--
--   PHASE 1 (this migration + the client that ships with it)
--     Adds the columns. The client DUAL-WRITES: every save writes the
--     sealed payloads and the plaintext columns. Reads prefer the
--     payload and fall back to plaintext. Build 17 keeps working
--     exactly as it does today, because the columns it reads are still
--     being maintained. The data is NOT yet private from the server —
--     the privacy copy must not claim otherwise until phase 2.
--
--   PHASE 2 (a later release, once build 17 is out of the field)
--     Client stops writing the plaintext columns. A migration then
--     nulls them, and can finally drop them. Three things have to move
--     in that same commit:
--       • the dual-write in app/profile.tsx (handleSaveContact,
--         handleSaveFamily, resealPastoralData)
--       • PRIVACY_COPY.settingsSummary and the two bullets in
--         app/privacy.tsx — contact details become genuinely private
--         at that point, and only then
--       • the PIN reset warning in app/_layout.tsx: once plaintext is
--         gone, "start fresh" also destroys contact and family details
--
-- Until phase 2 the plaintext columns are KEPT: dropping them now would
-- blank contact details for everyone still on build 17, and destroy the
-- rows of any member who has not opened the app since.
--
-- RLS is unchanged. "pastoral_contacts_foc_read" and
-- "pastoral_children_foc_read" still gate on
-- foc_id = auth.uid() and foc_consent_at is not null; they now return
-- ciphertext that only the FOC's device can open.
--
-- Safe to re-run.
-- ============================================================


-- ── 1. Sealed payload columns ────────────────────────────────

alter table public.pastoral_contacts
  add column if not exists payload_self    text,
  add column if not exists payload_foc     text,
  add column if not exists payload_foc_for uuid;

alter table public.pastoral_children
  add column if not exists payload_self    text,
  add column if not exists payload_foc     text,
  add column if not exists payload_foc_for uuid;


-- ── 2. Let the plaintext columns go empty ────────────────────
-- A sealed child row carries its name and birth year inside the
-- payload, so the old NOT NULL constraints would block every insert
-- the new client makes. Nothing is dropped — the columns stay for the
-- rows that have not been sealed yet.

alter table public.pastoral_children alter column name       drop not null;
alter table public.pastoral_children alter column birth_year drop not null;
