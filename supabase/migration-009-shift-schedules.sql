-- Migration 009: shift scheduling (roster).
-- The cashup page handles end-of-shift reconciliation, but there was no
-- way to plan who works when. This adds a restaurant-scoped roster so
-- owners/managers can schedule staff shifts and review the week ahead.

create table if not exists public.shift_schedules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  schedule_date date not null,
  start_time time not null,
  end_time time not null,
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists shift_schedules_restaurant_idx
  on public.shift_schedules (restaurant_id);
create index if not exists shift_schedules_date_idx
  on public.shift_schedules (schedule_date);

alter table public.shift_schedules enable row level security;

drop policy if exists "schedule select" on public.shift_schedules;
create policy "schedule select" on public.shift_schedules
  for select to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));

drop policy if exists "schedule insert" on public.shift_schedules;
create policy "schedule insert" on public.shift_schedules
  for insert to authenticated
  with check (restaurant_id in (select public.user_restaurant_ids()));

drop policy if exists "schedule update" on public.shift_schedules;
create policy "schedule update" on public.shift_schedules
  for update to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()))
  with check (restaurant_id in (select public.user_restaurant_ids()));

drop policy if exists "schedule delete" on public.shift_schedules;
create policy "schedule delete" on public.shift_schedules
  for delete to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));
