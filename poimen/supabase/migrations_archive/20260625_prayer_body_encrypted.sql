-- E2E encrypted prayer request bodies.
-- body_self: encrypted for the congregant (they can read their own requests).
-- body_foc: encrypted with the priest's public key (only the priest's device can decrypt).
-- body_servant: encrypted with the servant's public key (only the servant's device can decrypt).
-- Supabase stores only ciphertext — DB admins cannot read prayer content.
-- public_key on profiles: each user's NaCl box public key, registered on first sign-in.

alter table public.profiles
  add column if not exists public_key text;

alter table public.prayer_requests
  add column if not exists body_self text,
  add column if not exists body_foc text,
  add column if not exists body_servant text;
