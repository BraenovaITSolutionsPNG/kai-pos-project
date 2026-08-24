-- Migration 011: link actual shifts to scheduled shifts
-- An actual shift (clock-in/out) can now reference the roster entry it
-- fulfils. clock_in links to the staff member's schedule for the day when
-- one exists, so the Cashup page can show the scheduled start time and the
-- Shift Schedule roster can show which shifts are in progress / completed.

alter table public.shifts
  add column scheduled_shift_id uuid references public.shift_schedules (id) on delete set null;

create or replace function public.clock_in()
returns public.shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_shift public.shifts;
  v_schedule_id uuid;
begin
  select id into v_staff_id
  from public.staff
  where user_id = auth.uid() and is_active = true
  limit 1;

  if v_staff_id is null then
    raise exception 'No active staff record found';
  end if;

  -- Check if already clocked in
  if exists (
    select 1 from public.shifts
    where staff_id = v_staff_id and clock_out is null
  ) then
    raise exception 'Already clocked in';
  end if;

  -- Link to today's schedule for this staff member when one exists.
  select id into v_schedule_id
  from public.shift_schedules
  where staff_id = v_staff_id
    and schedule_date = current_date
  order by start_time
  limit 1;

  insert into public.shifts (restaurant_id, staff_id, clock_in, scheduled_shift_id)
  select restaurant_id, v_staff_id, now(), v_schedule_id
  from public.staff
  where id = v_staff_id
  returning * into v_shift;

  return v_shift;
end;
$$;
