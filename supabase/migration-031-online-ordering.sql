-- Online ordering support
-- Add order_source and delivery fields to orders table
alter table public.orders add column if not exists order_source text not null default 'pos' check (order_source in ('pos', 'online', 'phone'));
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_notes text;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists estimated_delivery_time timestamptz;
alter table public.orders add column if not exists delivery_status text check (delivery_status in ('pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'));

-- Public menu access (allow anon to read products for online ordering)
create policy if not exists "products public read" on public.products
  for select to anon
  using (is_active = true);

create policy if not exists "categories public read" on public.categories
  for select to anon
  using (true);

create policy if not exists "restaurants public read" on public.restaurants
  for select to anon
  using (true);

-- Allow anon to create orders (online ordering)
create policy if not exists "orders anon insert" on public.orders
  for insert to anon
  with check (order_source = 'online');

create policy if not exists "order_items anon insert" on public.order_items
  for insert to anon
  with check (true);
