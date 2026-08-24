-- Migration 010: harden get_active_shift
-- Postgres orders NULLs first in a DESC sort, so a shift with a null
-- clock_in could be wrongly returned as the "active" shift and render as
-- 1970-01-01 in the UI. Exclude null clock_ins and sort them last.

create or replace function public.get_active_shift()
returns public.shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_shift public.shifts;
begin
  select id into v_staff_id
  from public.staff
  where user_id = auth.uid() and is_active = true
  limit 1;

  if v_staff_id is null then
    return null;
  end if;

  select * into v_shift
  from public.shifts
  where staff_id = v_staff_id and clock_out is null and clock_in is not null
  order by clock_in desc nulls last
  limit 1;

  return v_shift;
end;
$$;
