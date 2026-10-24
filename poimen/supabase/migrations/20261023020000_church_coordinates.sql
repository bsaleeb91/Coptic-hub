-- Church coordinates, so the picker can put the nearest parishes first.
--
-- Filled in when an admin adds a church (geocoded in the browser through
-- Nominatim, see lib/geocode.ts) rather than when a member reads the list, so
-- the picker stays one plain select. A church without coordinates simply
-- sorts after the ones that have them.
--
-- Readable by anyone, like the rest of the row: these are the public
-- addresses of parishes, not anyone's personal location. A member's own
-- location is never sent to the server; the sorting happens on the phone.

alter table public.churches
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

alter table public.churches
  drop constraint if exists churches_coordinates_valid;
alter table public.churches
  add constraint churches_coordinates_valid check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  );

-- Backfill, geocoded 2026-10-23 with Nominatim from each church's address.
-- "100 Test Ave, Springfield, VA" (St. Mary & Archangel Michael) did not
-- match and is left without coordinates.
update public.churches set latitude = 38.8304818, longitude = -77.3572110
  where id = '9adb1c9f-b9ae-4621-9896-7e389aaad333';  -- 11911 Braddock Rd, Fairfax, VA
update public.churches set latitude = 41.4627850, longitude = -81.9059449
  where id = '18e706d2-8f98-4e35-96a0-4ca4d5ea471a';  -- 25800 Hilliard Blvd, Westlake, OH
update public.churches set latitude = 39.1095332, longitude = -77.5548852
  where id = '32d61988-a704-4b7f-b447-d9e71ed913bb';  -- 407 E Market St, Leesburg, VA
update public.churches set latitude = 38.8449272, longitude = -77.0844489
  where id = '65a637ba-a8cc-4bf6-9201-6b259264a62c';  -- 2640 Shirlington Rd, Arlington, VA
