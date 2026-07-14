-- The original check constraint was created before servant_only and foc_and_servant were
-- added to the visibility enum. DROP + re-add to include all four valid values.

alter table public.prayer_requests
  drop constraint if exists prayer_requests_visibility_check;

alter table public.prayer_requests
  add constraint prayer_requests_visibility_check
  check (visibility in ('private','foc_only','foc_and_servant','servant_only'));
