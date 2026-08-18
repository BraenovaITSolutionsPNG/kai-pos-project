-- ============================================================
-- KAI POS — Phase 1 Schema (PNG restaurant POS platform)
-- Run this in the Supabase SQL editor.
-- ============================================================

-- ------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------

-- Every tenant owns one or more businesses (SaaS subscription holder).
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users (id) on delete cascade,
  plan text not null default 'starter'
    check (plan in ('starter', 'business', 'professional')),
  created_at timestamptz not null default now()
);

-- One business can have multiple physical locations (restaurants).
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade not null,
  name text not null,
  address text,
  currency text not null default 'PGK',
  logo_url text,
  tax_rate numeric not null default 0 check (tax_rate >= 0),
  created_at timestamptz not null default now()
);

-- Mirrors auth.users so the app can store display names and phone numbers.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- Staff link a user to a restaurant with a role.
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  user_id uuid references public.users (id) on delete cascade not null,
  role text not null default 'cashier'
    check (role in ('owner', 'manager', 'cashier', 'kitchen')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

-- Product categories per restaurant.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

-- Menu products per restaurant.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Table / floor-plan (Phase 2 consumes this; Phase 1 keeps it simple).
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  label text not null,
  status text not null default 'available'
    check (status in ('available', 'occupied', 'reserved')),
  capacity integer not null default 4,
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, label)
);

-- Sales orders.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  table_id uuid references public.tables (id) on delete set null,
  order_number bigint not null,
  status text not null default 'paid'
    check (status in (
      'open', 'sent_to_kitchen', 'preparing', 'ready',
      'served', 'paid', 'cancelled'
    )),
  subtotal numeric(10, 2) not null default 0,
  tax numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, order_number)
);

-- Line items for an order.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade not null,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  notes text,
  status text not null default 'new'
    check (status in ('new', 'preparing', 'ready')),
  created_at timestamptz not null default now()
);

-- Payments against an order (methods logged, not processed online).
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders (id) on delete cascade not null,
  method text not null check (method in (
    'cash', 'eftpos', 'bank_transfer', 'bsp',
    'kina_bank', 'anz', 'westpac', 'other'
  )),
  amount numeric(10, 2) not null check (amount >= 0),
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_restaurant_created
  on public.orders (restaurant_id, created_at desc);
create index if not exists idx_products_restaurant
  on public.products (restaurant_id, category_id);
create index if not exists idx_categories_restaurant
  on public.categories (restaurant_id, sort_order);

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.restaurants enable row level security;
alter table public.users enable row level security;
alter table public.staff enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.tables enable row level security;

-- Helper: restaurants the current user is active staff at.
create or replace function public.user_restaurant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id
  from public.staff
  where user_id = auth.uid() and is_active = true;
$$;

-- businesses: owner, or through staff of one of its restaurants.
create policy "business access"
  on public.businesses
  using (
    owner_id = auth.uid()
    or id in (
      select business_id from public.restaurants
      where id in (select public.user_restaurant_ids())
    )
  );

-- restaurants: current user is active staff there.
create policy "restaurant access"
  on public.restaurants
  for select
  using (id in (select public.user_restaurant_ids()));

create policy "restaurant update"
  on public.restaurants
  for update
  using (id in (select public.user_restaurant_ids()));

-- staff: same restaurant.
create policy "staff access"
  on public.staff
  using (restaurant_id in (select public.user_restaurant_ids()));

-- users: read your own profile (and users at your restaurants for later phases).
create policy "user profile access"
  on public.users
  using (id = auth.uid());

-- categories: full access scoped to restaurants the user belongs to.
create policy "category select"
  on public.categories
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "category insert"
  on public.categories
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "category update"
  on public.categories
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "category delete"
  on public.categories
  for delete
  using (restaurant_id in (select public.user_restaurant_ids()));

-- products.
create policy "product select"
  on public.products
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "product insert"
  on public.products
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "product update"
  on public.products
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "product delete"
  on public.products
  for delete
  using (restaurant_id in (select public.user_restaurant_ids()));

-- orders.
create policy "order select"
  on public.orders
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "order insert"
  on public.orders
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "order update"
  on public.orders
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

-- order_items (via the parent order).
create policy "order_items select"
  on public.order_items
  for select
  using (
    order_id in (
      select id from public.orders
      where restaurant_id in (select public.user_restaurant_ids())
    )
  );

create policy "order_items insert"
  on public.order_items
  for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.restaurant_id in (select public.user_restaurant_ids())
    )
  );

create policy "order_items delete"
  on public.order_items
  for delete
  using (
    order_id in (
      select id from public.orders
      where restaurant_id in (select public.user_restaurant_ids())
    )
  );

-- payments (via the parent order).
create policy "payment select"
  on public.payments
  for select
  using (
    order_id in (
      select id from public.orders
      where restaurant_id in (select public.user_restaurant_ids())
    )
  );

create policy "payment insert"
  on public.payments
  for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.restaurant_id in (select public.user_restaurant_ids())
    )
  );

-- tables.
create policy "table select"
  on public.tables
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "table insert"
  on public.tables
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "table update"
  on public.tables
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "table delete"
  on public.tables
  for delete
  using (restaurant_id in (select public.user_restaurant_ids()));

-- ------------------------------------------------------------------
-- Sign-up provisioning
-- When a new auth user is created, provision their first tenant
-- (business + restaurant + owner staff + demo menu) so they land
-- in a working POS straight away.
-- ------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_restaurant_id uuid;
  v_food uuid;
  v_drinks uuid;
  v_snacks uuid;
  v_desserts uuid;
  v_full_name text := new.raw_user_meta_data ->> 'full_name';
  v_business_name text := new.raw_user_meta_data ->> 'business_name';
begin
  v_full_name := coalesce(nullif(v_full_name, ''), new.email);
  v_business_name := coalesce(nullif(v_business_name, ''), v_full_name || '''s Cafe');

  insert into public.users (id, email, full_name)
  values (new.id, new.email, v_full_name);

  insert into public.businesses (name, owner_id, plan)
  values (v_business_name, new.id, 'starter')
  returning id into v_business_id;

  insert into public.restaurants (business_id, name, address, currency)
  values (v_business_id, v_business_name || ' — Main', '', 'PGK')
  returning id into v_restaurant_id;

  insert into public.staff (restaurant_id, user_id, role, is_active)
  values (v_restaurant_id, new.id, 'owner', true);

  -- A starter menu so the POS is immediately usable.
  insert into public.categories (restaurant_id, name, sort_order) values
    (v_restaurant_id, 'Food', 1),
    (v_restaurant_id, 'Drinks', 2),
    (v_restaurant_id, 'Snacks', 3),
    (v_restaurant_id, 'Desserts', 4);

  select id into v_food from public.categories
    where restaurant_id = v_restaurant_id and name = 'Food';
  select id into v_drinks from public.categories
    where restaurant_id = v_restaurant_id and name = 'Drinks';
  select id into v_snacks from public.categories
    where restaurant_id = v_restaurant_id and name = 'Snacks';
  select id into v_desserts from public.categories
    where restaurant_id = v_restaurant_id and name = 'Desserts';

  insert into public.products
    (restaurant_id, category_id, name, price, sort_order) values
    (v_restaurant_id, v_food,    'Chicken Fried Rice',        25.00, 1),
    (v_restaurant_id, v_food,    'Fish & Chips',              32.00, 2),
    (v_restaurant_id, v_food,    'Chicken Steak',             38.00, 3),
    (v_restaurant_id, v_food,    'BBQ Pork Ribs',             42.00, 4),
    (v_restaurant_id, v_drinks,  'Coca-Cola (330ml)',          5.50, 1),
    (v_restaurant_id, v_drinks,  'Fresh Water (1.5L)',         5.00, 2),
    (v_restaurant_id, v_drinks,  'Mango Juice',                8.00, 3),
    (v_restaurant_id, v_snacks,  'Crisps',                     4.00, 1),
    (v_restaurant_id, v_snacks,  'Chicken Roll',              12.00, 2),
    (v_restaurant_id, v_desserts,'Ice Cream Sundae',           8.00, 1);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ------------------------------------------------------------------
-- Order numbering
-- Daily sequential order numbers per restaurant.
-- ------------------------------------------------------------------
create table public.order_counters (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  day date not null default current_date,
  last_number bigint not null default 0
);
alter table public.order_counters enable row level security;

create or replace function public.next_order_number(v_restaurant_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  insert into public.order_counters (restaurant_id, day, last_number)
  values (v_restaurant_id, current_date, 1)
  on conflict (restaurant_id) do update
    set last_number = case
      when public.order_counters.day < current_date then 1
      else public.order_counters.last_number + 1
    end,
    day = case
      when public.order_counters.day < current_date then current_date
      else public.order_counters.day
    end
  returning last_number into v_next;

  if v_next is null then
    select last_number into v_next
    from public.order_counters
    where restaurant_id = v_restaurant_id;
  end if;

  return v_next;
end;
$$;

create or replace function public.create_order(
  v_restaurant_id uuid,
  v_created_by uuid,
  p_items jsonb,
  v_method text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_subtotal numeric(10, 2) := 0;
  v_tax_rate numeric(10, 2);
  v_tax numeric(10, 2);
  v_total numeric(10, 2);
begin
  select tax_rate into v_tax_rate
  from public.restaurants
  where id = v_restaurant_id;

  select coalesce(v_tax_rate, 0) into v_tax_rate;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_subtotal := v_subtotal +
      ((v_item ->> 'quantity')::numeric * (v_item ->> 'unit_price')::numeric);
  end loop;

  v_tax := round(v_subtotal * v_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax;

  insert into public.orders
    (restaurant_id, order_number, status, subtotal, tax, total, created_by)
  values
    (v_restaurant_id, public.next_order_number(v_restaurant_id),
     'paid', v_subtotal, v_tax, v_total, v_created_by)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items
      (order_id, product_id, product_name, quantity, unit_price, notes)
    values
      (v_order.id,
       (v_item ->> 'product_id')::uuid,
       v_item ->> 'product_name',
       (v_item ->> 'quantity')::integer,
       (v_item ->> 'unit_price')::numeric,
       v_item ->> 'notes');
  end loop;

  insert into public.payments (order_id, method, amount)
  values (v_order.id, v_method, v_total);

  return v_order;
end;
$$;