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

## Now
- [ ] ~~OTA for 1.0.0~~ — **NOT POSSIBLE.** `eas fingerprint:compare` against
      build 17 shows its binary was built WITHOUT the `expo-updates` native module
      (also without `expo-crypto`), so App Store 1.0.0 never checks for OTA
      updates. The fix is ported on branch `fix/key-backup-1.0.0` (worktree
      `Coptic-hub-v100`) but must not be published — it would reach nobody, and
      its native fingerprint (`1525b776…`) doesn't match build 17 (`7b479ec8…`).
      1.0.0 users only get the fix by installing a new App Store build.
- [ ] **Decide the 1.0.0 gap:** until users move to 1.1.x, a 1.0.0 user who
      reinstalls or changes phone can have their backup overwritten. Options:
      a server-side backup-history trigger (keeps every replaced `key_backup`,
      so an overwrite is recoverable), and/or ship 1.1.x to the App Store soon.

## Next App Store release (1.1.x)
- [ ] Slow PIN key derivation — new `pinbak2:` format (Argon2/PBKDF2, pure JS,
      tuned to ~0.5 s on an older iPhone).
- [ ] Stronger PIN rule for new PINs (≥ 6 characters or a passphrase).
- [ ] One-time "re-enter your PIN" prompt to rewrap existing `pinbak1:` backups.
- [ ] Teach 1.0.0 to read `pinbak2:` (small OTA), or wait for 1.0.0 to retire.
- [ ] Release branch includes all of the above (a new binary replaces OTAs).

## Optional cleanup
- [ ] Review other SELECT policies for over-broad columns (`invite_code`,
      contact/family tables).
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
