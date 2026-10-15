# Private-notes security rollout — October 2026

Started 2026-10-13. Tracks closing the key-backup leak, fixing where private
notes go, and hardening the PIN. Tick items off as they land.

## Why
- Any signed-in user could read a priest's `profiles.key_backup` (the PIN-locked
  copy of the key that opens their notes, prayer requests and journal), via the
  "priest servant profiles are discoverable" policy. Verified live 2026-10-13.
- The PIN lock is a single SHA-512: a 4-digit PIN cracks in 0.09 s, 6 digits in
  8 s on one laptop core.
- The web app still sealed notes with a browser-only key (`enc1:`) that was never
  backed up.
- Private notes written in Log Encounter were saved but never shown anywhere.

## Done
- [x] **DB step 1** — `get_my_key_backup()` (own-row RPC). Applied 2026-10-14.
      `supabase/migrations/20261013010000_get_my_key_backup.sql`
- [x] **Web app → build 21 + key-backup fix** (`nepsis-main` `92970c1`). Forced
      Vercel build, aliased to poimen-app.vercel.app, live JS verified.
- [x] **DB step 2** — `key_backup` no longer selectable through the API.
      Applied 2026-10-14. `supabase/migrations/20261013020000_hide_key_backup_column.sql`.
      Rollback: `grant select on public.profiles to anon, authenticated;`
- [x] **Leak re-test** — member and owner checks pass (member: permission denied;
      owner: own backup via RPC; profile/flock reads still work).
- [x] **Web migration check** — the `enc1:` note written on the web became `box1:`
      after opening the updated web app in the same browser.
- [x] **Private encounter notes shown** on the member's Notes tab, combined with
      pastoral notes, read-only, author-only (`4006bcf`). Deployed to web.
- [x] **OTA for 1.1.0** published 2026-10-14 (update group
      `1d74bda5-b910-47a7-8c56-bf3857e2b445`, runtime 1.1.0, fingerprint matches
      build 21).

- [x] **1.1.0 OTA verified on TestFlight** 2026-10-14 — after two launches of
      build 21, Mark Ibrahim's Notes tab shows the confession notes.

- [x] **Priest-facing explainer** written as a shareable doc: "How Nepsis Protects
      Priests' Private Notes" — https://claude.ai/code/artifact/55bab711-0230-48d8-a908-b11f59fea5f5
      (private until shared from its Share menu).

- [x] **Backup-history safety net** — `private.key_backup_history` + trigger,
      applied 2026-10-14 (`20261014010000_key_backup_history.sql`).
- [x] **1.1.0 submitted to Apple** 2026-10-14 — build 22 (`4006bcf`), status
      "Waiting for Review"; expedited review granted ("We'll expedite review for
      Nepsis – Pastoral Care"). What's New text: `WHATS-NEW-1.1.0.txt`.

## Now
- [ ] Watch for Apple's review email; on approval, release 1.1.0.
- [ ] ~~OTA for 1.0.0~~ — **NOT POSSIBLE.** `eas fingerprint:compare` against
      build 17 shows its binary was built WITHOUT the `expo-updates` native module
      (also without `expo-crypto`), so App Store 1.0.0 never checks for OTA
      updates. The fix is ported on branch `fix/key-backup-1.0.0` (worktree
      `Coptic-hub-v100`) but must not be published — it would reach nobody, and
      its native fingerprint (`1525b776…`) doesn't match build 17 (`7b479ec8…`).
      1.0.0 users only get the fix by installing a new App Store build.
- [x] **Decide the 1.0.0 gap:** until users move to 1.1.x, a 1.0.0 user who
      reinstalls or changes phone can have their backup overwritten. Resolved
      with both: the backup-history trigger (applied) makes an overwrite
      recoverable, and 1.1.0 is submitted to the App Store.

## Slow PIN key derivation — built, not shipped (branch `feat/slow-pin-kdf`)
The PIN only runs at setup and on recovery (new phone, reinstall, new browser),
never on everyday unlocks, so a few seconds of cost is affordable.
- [x] New `pinbak2:` format: Argon2id via `@noble/hashes` (pure JS), 8 MiB,
      t=1 — about 3 s with no JIT on a laptop core, ~0.1 s in a browser.
      The parameters are stored in each backup, so the cost can be raised later.
- [x] New PINs must be at least 8 characters.
- [x] Setup warns the PIN can't be recovered by anyone, and requires ticking
      "I have written my PIN down" before saving.
- [x] Existing `pinbak1:` users: a one-time "Strengthen Your Recovery PIN"
      prompt (skippable, returns next launch) — only when this device holds the
      same key as the backup. Recovering with an old PIN of 8+ characters
      reseals silently; a shorter one leads straight into the prompt.
- [x] Old `pinbak1:` backups still open. Round-trip tested; iOS (Hermes) and web
      bundles build.
- [x] Native fingerprint unchanged (`811dbdc…` = builds 21/22) → ships as an
      OTA to 1.1.0, no new App Store build needed.
- [ ] Time it on a real (ideally older) iPhone; lower `m` if setup takes > ~5 s.
- [ ] Deploy: web (forced Vercel build + alias) and OTA to 1.1.0 together — both
      must be able to read `pinbak2:` before anyone writes one.
- Known gap: App Store 1.0.0 can't read `pinbak2:` and can't get OTAs. A 1.0.0
      user whose backup was resealed on another device can't restore on 1.0.0;
      the backup-history trigger keeps the old copy if they "start fresh".

## Optional cleanup
- [x] Policy review 2026-10-14 — found three gaps; migration
      `20261014020000_lock_down_profiles_encounters_canons.sql` closes two
      (PGlite-tested, 19/19):
      - not-signed-in users could list every priest/servant/admin (name,
        church, invite code, last seen) → discoverable policy now signed-in only
      - any user could write an encounter or canon into anyone's history →
        writes must target the writer's own flock/students; rows can't be
        repointed after creation
- [x] **Applied in Supabase** 2026-10-14. Verified with the anon key: signed out,
      `profiles` returns no rows (priests included); `churches` still public.
- [ ] Invite code isn't enforced server-side: joining a flock is a plain update
      of one's own `foc_id`. Needs a `join_flock(code)` RPC + app change.
- [ ] Still open: contact/family tables; priests' `last_seen_at` /
      `last_confession_at` visible to any signed-in user.
- [ ] Delete the leftover folder `C:\Users\17165\Coptic-hub-webmerge`.
- [ ] Remove branch `fix/key-backup-exposure` / `feat/private-encounter-notes`
      and the `Coptic-hub-keyfix` worktree once merged and shipped.

## Deploy gotchas hit along the way
- Vercel git auto-deploys were cache hits (2 s) and shipped old JS. Always:
  `vercel --prod --force --yes`, then
  `vercel alias set <new-deployment-url> poimen-app.vercel.app`, then check the
  live bundle.
- `eas update` must be built from code whose native fingerprint matches the
  installed build (`npx expo-updates fingerprint:generate --platform ios`).
  1.0.0 and 1.1.0 need separate updates from their own code.
