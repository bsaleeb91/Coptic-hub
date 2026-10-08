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
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied';
  end if;

  return query
    with counts as (
      select
        p.church_id as cid,
        count(*) filter (
          where p.role = 'priest'
        ) as n_priests,
        count(*) filter (
          where p.role = 'servant'
        ) as n_servants,
        count(*) filter (
          where p.role = 'congregant'
        ) as n_congregants,
        count(*) filter (
          where p.role = 'congregant'
            and p.foc_id is not null
        ) as n_foc
      from profiles p
      group by p.church_id
    )
    select
      c.id,
      c.name,
      coalesce(n.n_priests, 0),
      coalesce(n.n_servants, 0),
      coalesce(n.n_congregants, 0),
      coalesce(n.n_foc, 0)
    from churches c
    left join counts n on n.cid = c.id

    union all

    select
      null::uuid,
      null::text,
      n.n_priests,
      n.n_servants,
      n.n_congregants,
      n.n_foc
    from counts n
    where n.cid is null
      and n.n_priests
        + n.n_servants
        + n.n_congregants > 0

    order by 2 asc nulls last;
end;
$$;

-- Notes on the shape above, both of which have bitten this function:
--
--  • The CTE's columns are named n_* rather than priests/servants/etc.
--    Those are RETURNS TABLE names, which are variables in scope inside
--    plpgsql, so selecting a same-named column raises "column reference
--    is ambiguous" at CALL time — not when the function is created.
--    ORDER BY is by ordinal for the same reason.
--
--  • No `alter function ... owner to postgres` here. The SQL editor runs
--    a pasted batch in one transaction, so a privilege error on that line
--    would roll back the definition with it. `create or replace` keeps
--    the existing owner anyway, so it was a no-op worth dropping.
