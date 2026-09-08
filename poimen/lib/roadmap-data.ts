// lib/roadmap-data.ts
// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: ROADMAP.md ("Next Up" block) · regenerate with: npm run gen:roadmap
// Item ids are derived from position, so reordering the markdown resets the
// admin screen's check state for the items that moved.

export type RoadmapItem = { id: string; label: string; note?: string; detail?: string[] };
export type RoadmapPhase = { id: string; title: string; items: RoadmapItem[] };

export const PHASES: RoadmapPhase[] = [
  {
    "id": "queued-2026-09-02",
    "title": "Queued 2026-09-02",
    "items": [
      {
        "id": "queued-2026-09-02-1",
        "label": "Add full address to the database (congregant profile/contact)"
      },
      {
        "id": "queued-2026-09-02-2",
        "label": "In-app feedback mechanism built into the app"
      },
      {
        "id": "queued-2026-09-02-3",
        "label": "Community feature: streaks and leaderboards for Psalm memorization"
      },
      {
        "id": "queued-2026-09-02-4",
        "label": "Reminder notifications for Psalms and Canon"
      },
      {
        "id": "queued-2026-09-02-5",
        "label": "Tutorial of the app, especially the Confession module"
      }
    ]
  },
  {
    "id": "queued-2026-09-07",
    "title": "Queued 2026-09-07",
    "items": [
      {
        "id": "queued-2026-09-07-1",
        "label": "Encrypt all personally identifiable information",
        "note": "The tweetnacl box-keypair infrastructure already exists in lib/crypto.ts and is used for confession entries (lib/confession/store.ts) and prayer requests. This extends the same treatment to the rest of the PII surface — profile fields (full name, the address fields queued above, phone, date of birth), priest pastoral notes and private encounter notes, and journal entries — so that what sits in Supabase is ciphertext rather than plaintext the server can read. Open questions to settle first",
        "detail": [
          "Key custody and recovery. Confession already has a PIN-wrapped keypair backup (encryptKeypairWithPIN); a lost key currently means lost data. Encrypting profile identity fields raises the stakes on that considerably.",
          "What must stay queryable server-side. Encrypted columns can't be searched, sorted, or joined — this affects the priest roster, member lookup, and any admin dashboard listing. Decide per field whether it's encrypted, hashed for lookup, or deliberately left in the clear.",
          "Migration path for existing rows now that the app is live."
        ]
      },
      {
        "id": "queued-2026-09-07-2",
        "label": "Say plainly, in more than one place, what is private and what stays on the device",
        "note": "Today this copy exists on the Confession tab (\"Private — encrypted and kept on this device\") and as a single PrivacyNote on the Canon tab. It should be visible wherever someone is deciding whether to enter something personal",
        "detail": [
          "Onboarding — one screen on what is stored locally vs. synced, before the first entry is made",
          "Settings — a standing \"Your data & privacy\" section, readable at any time",
          "Sign-up — at the point of account creation",
          "Inline on Prayer, Journal, and the vitals-sharing consent flow, matching the treatment Confession already gets",
          "Copy should be specific rather than reassuring: name what is encrypted, name what leaves the device, and name who can see it (Father of Confession, servant, admin) for each kind of entry."
        ]
      },
      {
        "id": "queued-2026-09-07-3",
        "label": "Remove the priest approval process",
        "note": "Sign-up currently records profiles.requested_role = 'priest', leaves the account as a congregant, and waits for an admin to run approve_priest_request from the web admin dashboard (20260719050000_signup_role_selection.sql, app/admin.tsx). It's cumbersome and blocks real priests from using the app on the day they install it. Worth deciding deliberately, since the priest role is not cosmetic — it grants visibility into congregants' Spiritual Vitals, confession history, and pastoral notes, and the current gate is the only thing standing between self-declaration and that access. Options, cheapest first",
        "detail": [
          "Grant priest at sign-up, but require a congregant to explicitly link to a Father of Confession before any of their data is visible (the FOC link flow in link-to-foc.tsx already exists and is congregant-initiated) — the consent gate moves from the admin to the person whose data it is",
          "Church-issued invite code at sign-up, no admin round-trip",
          "Keep approval only for the admin role, drop it for priest"
        ]
      },
      {
        "id": "queued-2026-09-07-4",
        "label": "Make the Canon page more usable, and let every Spiritual Vital be tracked there",
        "note": "The governing rule: *anything shown in Spiritual Vitals must be loggable in the Canon.* Right now that doesn't hold —",
        "detail": [
          "Communion — not tracked at all, and not currently a vital. It appears only as neglect_communion in the sin catalogue and as \"Communion Readiness\" in the confession flow. Add it as a first-class canon item and vital so a member can log when they received.",
          "Liturgy — VITAL_CATEGORIES has a liturgy row matching svc_* and weekly service keys, but those keys only exist when a priest has assigned a services rule in counts mode. A member with no assigned rule has no way to log that they attended. Self-logging should not depend on a priest having set something up.",
          "Confession — the vital exists with match: () => false and permanently reads \"—\" (lib/canon/history.ts). Either wire it to the confession dates already recorded, or remove the row.",
          "Usability pass on the tab itself alongside this: the 7-day backfill strip, how count-based weekly commitments read mid-week (\"1 of 2 this week\"), and making the difference between a priest-assigned canon item and a self-chosen one legible at a glance. --- A commit-by-commit plan. Each commit is meant to be independently reviewable, ship-ready on your phone (from commit 1 onwards), and focused on one theme. Effort estimates assume part-time work; double them if you have a busy week. Each commit answers one question: \"what can you demo at the end of it?\" ---"
        ]
      }
    ]
  }
];
