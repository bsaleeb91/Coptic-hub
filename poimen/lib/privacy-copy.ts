// lib/privacy-copy.ts
// One place to say what is private, so the app cannot contradict itself.
//
// This exists because it already went wrong twice. app/privacy.tsx told members
// pastoral notes were "not end-to-end encrypted" months after they were; the
// congregant tutorial told them the confession journal is "never saved", when
// it is saved — encrypted, on the device. One under-claimed, one over-claimed,
// and neither was caught because the wording lived wherever it was rendered.
//
// Rules for editing anything here:
//   1. Name what is encrypted, what leaves the device, and who can see it.
//      "Private and secure" says nothing a member can check.
//   2. Never write a promise the code does not keep. If the answer is "stored
//      on our servers, readable by us", say that instead of softening it.
//   3. If behaviour changes, this file changes in the same commit.

// What actually happens to each kind of entry, as of 2026-09-13.
//
//   confession journal   AsyncStorage only, sealed to the member's keypair.
//                        Never sent to Supabase. (lib/confession/store.ts)
//   prayer body          Sealed per recipient before upload; the server holds
//                        ciphertext only. (app/(tabs)/prayer.tsx)
//   pastoral notes       Sealed to the author's keypair before upload; only
//                        the author can open them. (lib/db/pastoral.ts)
//   journal entries      Stored in agent_progress as plain text today.
//   canon + vitals       Check-offs stay on device; adherence percentages
//                        reach the FOC only after consent.
//   profile fields       Name, church, and confession dates are stored plainly
//                        so the app can list and match on them.
//   contact + family     PHASE 1 of the rollout: pastoral_contacts (phone,
//                        email, full address) and pastoral_children (names and
//                        birth years) are written BOTH sealed and in plain
//                        text, because build 17 reads only the plain columns.
//                        So they are NOT yet private from us — do not say they
//                        are until phase 2 clears the plaintext. Update this
//                        copy in the same commit that does.
//                        pastoral_profile (spouse, life stage) stays plain.

export const PRIVACY_COPY = {
  // Confession tab. The journal IS saved — locally, encrypted. Saying
  // "never saved" was wrong and made the real guarantee sound smaller.
  confession:
    'Your examination and journal are encrypted on this device and never sent to our servers. ' +
    'Only the dates you confess are shared with your Father of Confession — never what you wrote.',

  // Prayer tab. Bodies are sealed per recipient before they are uploaded.
  prayer:
    'The words of your request are encrypted before they leave this device, for the people you ' +
    'pick and no one else. We store them but cannot read them.',

  // Journal tab. Plain text on the server today — say so rather than imply
  // the encryption the confession journal gets.
  journal:
    'Journal entries are stored on our servers and are not yet encrypted. Your Father of ' +
    'Confession sees an entry only if you flag it for confession.',

  // Vitals sharing consent.
  vitals:
    'Your Father of Confession sees adherence percentages, never the individual check-offs, and ' +
    'only while you leave this on. You can withdraw it at any time.',

  // Canon tab.
  canon: 'Your spiritual canon stays private to you — it is never shared with anyone.',

  // Sign-up, before an account exists.
  signup:
    'What you write in Confession stays on your device. Prayer requests and pastoral notes are ' +
    'encrypted so only their intended reader can open them.',

  // Onboarding / tutorial step.
  onboardingTitle: 'What stays on your device',
  onboarding:
    'Your confession journal never leaves this phone. Prayer requests are encrypted for their ' +
    'recipients before they are sent. Your canon is yours alone — your Father of Confession sees ' +
    'adherence only after you turn sharing on. Settings → Your data & privacy has the full picture.',

  // Profile / settings section.
  settingsTitle: 'Your data & privacy',
  settingsSummary:
    'On this device only: your confession examination and journal. ' +
    'Encrypted before upload: prayer request bodies, and the notes your priest writes. ' +
    'Stored as written: your name, church, journal entries, confession dates, and anything you ' +
    'enter for visitation — phone, address, and family details.',
} as const;
