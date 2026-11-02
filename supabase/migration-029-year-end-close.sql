-- Year-end close: archive tables for transactional data
-- These preserve historical records while allowing a clean slate for the new year.

create table if not exists public.orders_archive (like public.orders including all);
create table if not exists public.order_items_archive (like public.order_items including all);
create table if not exists public.payments_archive (like public.payments including all);
create table if not exists public.expenses_archive (like public.expenses including all);
create table if not exists public.shifts_archive (like public.shifts including all);
create table if not exists public.cashups_archive (like public.cashups including all);
create table if not exists public.inventory_transactions_archive (like public.inventory_transactions including all);

-- Add a fiscal_year column to archive tables for easy filtering
alter table public.orders_archive add column if not exists fiscal_year integer;
alter table public.expenses_archive add column if not exists fiscal_year integer;
alter table public.shifts_archive add column if not exists fiscal_year integer;
alter table public.cashups_archive add column if not exists fiscal_year integer;
alter table public.inventory_transactions_archive add column if not exists fiscal_year integer;

-- RLS for archive tables (same as original)
alter table public.orders_archive enable row level security;
alter table public.order_items_archive enable row level security;
alter table public.payments_archive enable row level security;
alter table public.expenses_archive enable row level security;
alter table public.shifts_archive enable row level security;
alter table public.cashups_archive enable row level security;
alter table public.inventory_transactions_archive enable row level security;

-- Platform admins and restaurant staff can read their own archived data
create policy "orders_archive select" on public.orders_archive
  for select to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));
create policy "order_items_archive select" on public.order_items_archive
  for select to authenticated
  using (order_id in (select id from public.orders_archive));
create policy "payments_archive select" on public.payments_archive
  for select to authenticated
  using (order_id in (select id from public.orders_archive));
create policy "expenses_archive select" on public.expenses_archive
  for select to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));
create policy "shifts_archive select" on public.shifts_archive
  for select to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));
create policy "cashups_archive select" on public.cashups_archive
  for select to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));
create policy "inventory_transactions_archive select" on public.inventory_transactions_archive
  for select to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));

