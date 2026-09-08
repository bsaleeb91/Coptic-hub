-- Structured address for churches.
--
-- `churches.address` has been a single free-text blob since the baseline
-- schema, while a member's own address (pastoral_contacts) has always been
-- broken into street/city/state/zip/country. That asymmetry means the church
-- picker can only match on raw text, and nothing can group or sort parishes by
-- city — or, later, order them by distance.
--
-- The legacy column is KEPT rather than dropped or parsed. Free-text addresses
-- entered by hand do not split reliably ("St. Mary, 123 Main St Unit 2,
-- Columbus OH"), and a bad guess would silently corrupt a real parish address.
-- Existing rows therefore keep their text, and readers fall back to it when the
-- structured fields are empty. An admin filling in the structured fields is
-- what migrates a row.
alter table public.churches
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city          text,
  add column if not exists state         text,
  add column if not exists zip           text,
  add column if not exists country       text default 'US';

-- The picker searches name, city and street as you type. Churches is a small,
-- read-mostly table, so a trigram index is more than it needs; a plain index on
-- lower(city) keeps the common "everyone in one city" grouping cheap.
create index if not exists churches_city_idx on public.churches (lower(city));

-- No policy changes: churches is already world-readable to authenticated users
-- and insert/update stays gated on is_admin(), which is what these columns want
-- too — a parish address is public information, and only an admin may set it.
