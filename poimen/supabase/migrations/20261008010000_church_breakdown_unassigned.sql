-- ============================================================
-- Migration: account for members with no church — 2026-10-08
--
-- get_church_breakdown counted per-role signups and FOC links per
-- church already, but it joined profiles ON p.church_id = c.id, so an
-- account with church_id null appeared in no row at all. Nothing in
-- sign-up sets church_id: handle_new_user inserts id, full_name and
-- role only, and the column is written in exactly one place, the
-- Profile screen's church picker (app/profile.tsx). So every account
-- is unassigned until its owner opens Profile and picks, and the
-- breakdown silently omitted most of the user base — the per-church
-- counts never summed to the totals at the top of the dashboard, with
-- nothing on screen to say why.
--
-- A final "unassigned" row is appended: church_id and church_name
-- null, counted the same three ways. The client renders it as its own
-- card. The row is suppressed entirely when nothing is unassigned, so
-- a fully-assigned deployment sees exactly what it saw before.
--
-- Admins stay uncounted, here as in the per-church rows, which count
-- only priest/servant/congregant. The HAVING therefore tests those
-- three roles rather than count(*), so a row never appears for admin
-- accounts alone (which would read 0/0/0 and look like a bug).
--
-- Signature is unchanged, so an older client calling this still works.
-- Safe to re-run.
-- ============================================================

create or replace function public.get_church_breakdown()
returns table (
  church_id uuid,
  church_name text,
  priests bigint,
  servants bigint,
  congregants bigint,
  foc_linked bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Access denied'; end if;
  return query
    select
      c.id   as church_id,
      c.name as church_name,
      count(*) filter (where p.role = 'priest')                              as priests,
      count(*) filter (where p.role = 'servant')                             as servants,
      count(*) filter (where p.role = 'congregant')                          as congregants,
      count(*) filter (where p.role = 'congregant' and p.foc_id is not null) as foc_linked
    from churches c
    left join profiles p on p.church_id = c.id
    group by c.id, c.name

    union all

    -- The accounts no church row can see. Aggregate with no GROUP BY,
    -- so HAVING collapses it to zero rows when there are none.
    select
      null::uuid,
      null::text,
      count(*) filter (where p.role = 'priest'),
      count(*) filter (where p.role = 'servant'),
      count(*) filter (where p.role = 'congregant'),
      count(*) filter (where p.role = 'congregant' and p.foc_id is not null)
    from profiles p
    where p.church_id is null
    having count(*) filter (where p.role in ('priest', 'servant', 'congregant')) > 0

    -- Churches alphabetical, the unassigned row last. By ordinal, not by
    -- name: church_name is also a RETURNS TABLE variable in scope here, so
    -- naming it in ORDER BY raises "column reference is ambiguous". The
    -- pre-union version sidestepped this with `order by c.name`, which a
    -- UNION cannot reference.
    order by 2 asc nulls last;
end;
$$;

alter function public.get_church_breakdown() owner to postgres;
