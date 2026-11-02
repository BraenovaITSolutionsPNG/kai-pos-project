-- Table reservations
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  party_size integer not null default 2,
  reservation_date date not null,
  reservation_time time not null,
  duration_minutes integer not null default 90,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reservations_restaurant_date_idx on public.reservations (restaurant_id, reservation_date);
create index if not exists reservations_table_idx on public.reservations (table_id);

alter table public.reservations enable row level security;

create policy "reservations_select" on public.reservations
  for select to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "reservations_insert" on public.reservations
  for insert to authenticated
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "reservations_update" on public.reservations
  for update to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "reservations_delete" on public.reservations
  for delete to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));
