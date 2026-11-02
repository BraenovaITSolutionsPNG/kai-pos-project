-- Online ordering support
-- Add order_source and delivery fields to orders table
alter table public.orders add column if not exists order_source text not null default 'pos';
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_notes text;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists estimated_delivery_time timestamptz;
alter table public.orders add column if not exists delivery_status text;

-- Public menu access
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select to anon
  using (is_active = true);

drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories
  for select to anon
  using (true);

drop policy if exists "restaurants public read" on public.restaurants;
create policy "restaurants public read" on public.restaurants
  for select to anon
  using (true);

-- Allow anon to create orders (online ordering)
drop policy if exists "orders anon insert" on public.orders;
create policy "orders anon insert" on public.orders
  for insert to anon
  with check (order_source = 'online');

drop policy if exists "order_items anon insert" on public.order_items;
create policy "order_items anon insert" on public.order_items
  for insert to anon
  with check (true);
