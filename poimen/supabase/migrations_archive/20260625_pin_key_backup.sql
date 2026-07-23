-- PIN-protected keypair backup for E2E encrypted prayer bodies.
-- Stores the user's NaCl box private key encrypted with a PIN-derived key.
-- Poimen never sees the PIN or the plaintext private key.
-- If the user loses their device, they enter their PIN to recover their keypair.

alter table public.profiles
  add column if not exists key_backup text;
