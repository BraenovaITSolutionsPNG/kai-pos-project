-- ============================================================
-- KAI POS Ã¢â‚¬â€ Complete Schema (PNG restaurant POS platform)
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
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual')),
  current_period_end timestamptz,
  is_active boolean not null default false,
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
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Staff link a user to a restaurant with a role.
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  user_id uuid references public.users (id) on delete cascade not null,
  role text not null default 'cashier'
    check (role in ('owner', 'manager', 'cashier', 'kitchen', 'waiter')),
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
  status text not null default 'open'
    check (status in (
      'open', 'sent_to_kitchen', 'preparing', 'ready',
      'served', 'paid', 'cancelled'
    )),
  order_type text not null default 'dine_in'
    check (order_type in ('dine_in', 'takeaway')),
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

-- Customers (for future loyalty/online ordering).
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now()
);

-- Expenses tracking.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  category text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  note text,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- Scheduled shifts are declared before shifts because shifts references them.
create table public.shift_schedules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  schedule_date date not null,
  start_time time not null,
  end_time time not null,
  notes text not null default '''',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Shifts for staff clock-in/out.
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  staff_id uuid references public.staff (id) on delete cascade not null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  scheduled_shift_id uuid references public.shift_schedules (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Daily cashup reconciliation.
create table public.cashups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  shift_id uuid references public.shifts (id) on delete set null,
  cash_total numeric(10, 2) not null default 0,
  eftpos_total numeric(10, 2) not null default 0,
  bank_transfer_total numeric(10, 2) not null default 0,
  refunds numeric(10, 2) not null default 0,
  expenses numeric(10, 2) not null default 0,
  net_sales numeric(10, 2) not null default 0,
  closed_by uuid references public.users (id),
  closed_at timestamptz not null default now(),
  unique (shift_id)
);

-- Ingredients for inventory.
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  name text not null,
  unit text not null,
  current_stock numeric(10, 3) not null default 0,
  reorder_level numeric(10, 3) not null default 0,
  created_at timestamptz not null default now()
);

-- Recipes linking products to ingredients.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  product_id uuid references public.products (id) on delete cascade not null,
  ingredient_id uuid references public.ingredients (id) on delete cascade not null,
  quantity_required numeric(10, 3) not null check (quantity_required > 0),
  created_at timestamptz not null default now(),
  unique (product_id, ingredient_id)
);

-- Inventory transactions (stock movements).
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  ingredient_id uuid references public.ingredients (id) on delete cascade not null,
  type text not null
    check (type in ('restock', 'sale_deduction', 'adjustment', 'waste')),
  quantity numeric(10, 3) not null,
  reference_order_id uuid references public.orders (id) on delete set null,
  reference text,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- Notifications (for admin panel).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  message text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Site content (for landing page CMS).
create table public.site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_restaurant_created
  on public.orders (restaurant_id, created_at desc);
create index if not exists idx_products_restaurant
  on public.products (restaurant_id, category_id);
create index if not exists idx_categories_restaurant
  on public.categories (restaurant_id, sort_order);
create index if not exists idx_inventory_transactions_ingredient
  on public.inventory_transactions (ingredient_id, created_at desc);
create index if not exists idx_shifts_restaurant_staff
  on public.shifts (restaurant_id, staff_id, clock_in desc);
create index if not exists idx_cashups_restaurant
  on public.cashups (restaurant_id, closed_at desc);
create index if not exists idx_expenses_restaurant
  on public.expenses (restaurant_id, created_at desc);

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
alter table public.customers enable row level security;
alter table public.expenses enable row level security;
alter table public.shifts enable row level security;
alter table public.cashups enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.site_content enable row level security;

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

-- customers.
create policy "customer select"
  on public.customers
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "customer insert"
  on public.customers
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "customer update"
  on public.customers
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "customer delete"
  on public.customers
  for delete
  using (restaurant_id in (select public.user_restaurant_ids()));

-- expenses.
create policy "expense select"
  on public.expenses
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "expense insert"
  on public.expenses
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "expense update"
  on public.expenses
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "expense delete"
  on public.expenses
  for delete
  using (restaurant_id in (select public.user_restaurant_ids()));

-- shifts.
create policy "shift select"
  on public.shifts
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "shift insert"
  on public.shifts
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "shift update"
  on public.shifts
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "shift delete"
  on public.shifts
  for delete
  using (restaurant_id in (select public.user_restaurant_ids()));

-- cashups.
create policy "cashup select"
  on public.cashups
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "cashup insert"
  on public.cashups
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "cashup update"
  on public.cashups
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

-- ingredients.
create policy "ingredient select"
  on public.ingredients
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "ingredient insert"
  on public.ingredients
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "ingredient update"
  on public.ingredients
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "ingredient delete"
  on public.ingredients
  for delete
  using (restaurant_id in (select public.user_restaurant_ids()));

-- recipes.
create policy "recipe select"
  on public.recipes
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "recipe insert"
  on public.recipes
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "recipe update"
  on public.recipes
  for update
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "recipe delete"
  on public.recipes
  for delete
  using (restaurant_id in (select public.user_restaurant_ids()));

-- inventory_transactions.
create policy "inventory_transaction select"
  on public.inventory_transactions
  for select
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "inventory_transaction insert"
  on public.inventory_transactions
  for insert
  with check (restaurant_id in (select public.user_restaurant_ids()));

-- site_content (read-only for non-admin).
create policy "site_content read"
  on public.site_content
  for select
  using (true);

-- notifications.
create policy "notification access"
  on public.notifications
  using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- Sign-up provisioning
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
  v_plan text := coalesce(nullif(new.raw_user_meta_data ->> 'plan', ''), 'starter');
begin
  -- Staff accounts created via add_staff() only need a profile row;
  -- they belong to their employer's restaurant, not their own tenant.
  if coalesce(new.raw_user_meta_data ->> 'staff_only', '') = 'true' then
    insert into public.users (id, email, full_name)
    values (
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'full_name'
    )
    on conflict (id) do nothing;
    return new;
  end if;

  if v_plan not in ('starter', 'business', 'professional') then
    v_plan := 'starter';
  end if;

  v_full_name := coalesce(nullif(v_full_name, ''), new.email);
  v_business_name := coalesce(nullif(v_business_name, ''), v_full_name || '''s Cafe');

  insert into public.users (id, email, full_name)
  values (new.id, new.email, v_full_name);

  -- Businesses start INACTIVE: the owner must submit a payment that an
  -- admin approves before the dashboard unlocks.
  insert into public.businesses (name, owner_id, plan, is_active)
  values (v_business_name, new.id, v_plan, false)
  returning id into v_business_id;

  insert into public.restaurants (business_id, name, address, currency)
  values (v_business_id, v_business_name || ' â€” Main', '', 'PGK')
  returning id into v_restaurant_id;

  insert into public.staff (restaurant_id, user_id, role, is_active)
  values (v_restaurant_id, new.id, 'owner', true);

  -- A starter menu so the POS is ready once activated.
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
-- ------------------------------------------------------------------

create table public.order_counters (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  day date not null default current_date,
  last_number bigint not null default 0
);
alter table public.order_counters enable row level security;

create policy "order_counter access"
  on public.order_counters
  using (restaurant_id in (select public.user_restaurant_ids()))
  with check (restaurant_id in (select public.user_restaurant_ids()));

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

-- ------------------------------------------------------------------
-- Core RPCs
-- ------------------------------------------------------------------

-- Create order (used by POS)
create or replace function public.create_order(
  v_restaurant_id uuid,
  v_created_by uuid,
  p_items jsonb,
  v_method text,
  v_order_type text default 'dine_in',
  v_table_id uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_actor uuid := auth.uid();
  v_item jsonb;
  v_clean_items jsonb := '[]'::jsonb;
  v_product record;
  v_quantity integer;
  v_note text;
  v_subtotal numeric(10, 2) := 0;
  v_tax_rate numeric(10, 2);
  v_tax numeric(10, 2);
  v_total numeric(10, 2);
  v_eff_type text := coalesce(v_order_type, 'dine_in');
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_created_by is distinct from v_actor then
    raise exception 'Order creator must match the signed-in user' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.staff s
    where s.user_id = v_actor
      and s.restaurant_id = v_restaurant_id
      and s.is_active = true
      and s.role in ('owner', 'manager', 'cashier', 'waiter')
  ) then
    raise exception 'You do not have POS access to this restaurant' using errcode = '42501';
  end if;

  select tax_rate into v_tax_rate
  from public.restaurants
  where id = v_restaurant_id;

  if not found then
    raise exception 'Restaurant not found' using errcode = '23503';
  end if;

  select coalesce(v_tax_rate, 0) into v_tax_rate;

  if v_eff_type not in ('dine_in', 'takeaway') then
    raise exception 'Unsupported order type' using errcode = '22023';
  end if;

  if v_eff_type = 'dine_in' and v_table_id is null then
    raise exception 'A table is required for dine-in orders' using errcode = '22023';
  end if;

  if v_eff_type = 'takeaway' and v_table_id is not null then
    raise exception 'Takeaway orders cannot reference a table' using errcode = '22023';
  end if;

  if v_table_id is not null then
    perform 1 from public.tables t
    where t.id = v_table_id and t.restaurant_id = v_restaurant_id
    for update;
    if not found then
      raise exception 'Table not found for this restaurant' using errcode = '23503';
    end if;
  end if;

  if v_method is null or v_method not in (
    'cash', 'eftpos', 'bank_transfer', 'bsp', 'kina_bank', 'anz', 'westpac', 'other'
  ) then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one order item is required' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as item(value)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or nullif(v_item ->> 'product_id', '') is null
      or nullif(v_item ->> 'quantity', '') is null then
      raise exception 'Invalid order item' using errcode = '22023';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity <= 0 then
      raise exception 'Order quantities must be positive integers' using errcode = '22023';
    end if;

    v_note := v_item ->> 'notes';
    if length(v_note) > 500 then
      raise exception 'Order item notes are too long' using errcode = '22023';
    end if;

    select p.id, p.name, p.price into v_product
    from public.products p
    where p.id = (v_item ->> 'product_id')::uuid
      and p.restaurant_id = v_restaurant_id
      and p.is_active = true
    for share;

    if not found then
      raise exception 'Product is invalid, inactive, or belongs to another restaurant' using errcode = '23503';
    end if;

    v_subtotal := v_subtotal + (v_quantity * v_product.price);
    v_clean_items := v_clean_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'quantity', v_quantity,
      'unit_price', v_product.price,
      'notes', v_note
    ));
  end loop;

  if jsonb_array_length(v_clean_items) = 0 then
    raise exception 'At least one valid order item is required' using errcode = '22023';
  end if;

  v_tax := round(v_subtotal * v_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax;

  insert into public.orders
    (restaurant_id, order_number, status, subtotal, tax, total, created_by, order_type, table_id)
  values
    (v_restaurant_id, public.next_order_number(v_restaurant_id),
     'open', v_subtotal, v_tax, v_total, v_actor,
     v_eff_type, v_table_id)
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(v_clean_items) as item(value)
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

  -- A dine-in order occupies its table.
  if v_eff_type = 'dine_in' then
    update public.tables
    set status = 'occupied'
    where id = v_table_id
      and restaurant_id = v_restaurant_id;
  end if;

  return v_order;
end;
$$;

revoke all on function public.create_order(uuid, uuid, jsonb, text, text, uuid) from PUBLIC, anon;
grant execute on function public.create_order(uuid, uuid, jsonb, text, text, uuid) to authenticated;

-- Advance kitchen order status (used by KDS)
create or replace function public.advance_kitchen(
  order_id uuid,
  action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_new_status text;
  v_item_status text;
  v_role text;
  v_msg text;
  v_table_label text;
begin
  if advance_kitchen.action not in ('preparing', 'ready', 'served') then
    raise exception 'Invalid action: %', advance_kitchen.action;
  end if;

  select * into v_order
  from public.orders
  where id = advance_kitchen.order_id
    and restaurant_id in (select public.user_restaurant_ids());

  if not found then
    raise exception 'Order not found or access denied';
  end if;

  -- Only kitchen staff may update order progress.
  select s.role into v_role
  from public.staff s
  where s.user_id = auth.uid()
    and s.restaurant_id = v_order.restaurant_id
    and s.is_active = true
  limit 1;

  if coalesce(v_role, '') <> 'kitchen' then
    raise exception 'Only kitchen staff can update orders';
  end if;

  case advance_kitchen.action
    when 'preparing' then
      v_new_status := 'preparing';
      v_item_status := 'preparing';
    when 'ready' then
      v_new_status := 'ready';
      v_item_status := 'ready';
    when 'served' then
      v_new_status := 'served';
      v_item_status := 'ready';
  end case;

  update public.orders
  set status = v_new_status,
      updated_at = now()
  where id = advance_kitchen.order_id;

  if advance_kitchen.action in ('preparing', 'ready') then
    update public.order_items
    set status = v_item_status
    where order_items.order_id = advance_kitchen.order_id
      and order_items.status = 'new';

    if advance_kitchen.action = 'ready' then
      update public.order_items
      set status = 'ready'
      where order_items.order_id = advance_kitchen.order_id
        and order_items.status = 'preparing';
    end if;
  end if;

  if advance_kitchen.action = 'served' then
    update public.order_items
    set status = 'ready'
    where order_items.order_id = advance_kitchen.order_id;

    -- A served dine-in order frees its table.
    if v_order.table_id is not null then
      update public.tables
      set status = 'available'
      where id = v_order.table_id
        and restaurant_id = v_order.restaurant_id;
    end if;
  end if;

  -- Notify non-kitchen staff (waiters, cashiers, managers, owners) when an
  -- order is ready to serve or pick up.
  if advance_kitchen.action = 'ready' then
    select t.label into v_table_label
    from public.tables t
    where t.id = v_order.table_id;

    v_msg := 'Order #' || v_order.order_number ||
             case when v_order.order_type = 'takeaway'
                  then ' is ready for pickup'
                  else ' is ready to serve' end ||
             case when v_table_label is not null
                  then ' (Table ' || v_table_label || ')'
                  else '' end;

    insert into public.notifications (user_id, message, link)
    select s.user_id, v_msg, '/orders'
    from public.staff s
    where s.restaurant_id = v_order.restaurant_id
      and s.is_active = true
      and s.role in ('waiter', 'cashier')
      and not exists (
        select 1 from public.notifications n
        where n.user_id = s.user_id
          and n.link = '/orders'
          and n.message = v_msg
          and n.read_at is null
      );
  end if;
end;
$$;

-- Add staff member (creates auth user + staff record)
create or replace function public.add_staff(
  email text,
  full_name text,
  password text,
  role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_restaurant_id uuid;
begin
  select restaurant_id into v_restaurant_id
  from public.staff
  where user_id = auth.uid() and is_active = true
  limit 1;

  if v_restaurant_id is null then
    raise exception 'No active restaurant found for current user';
  end if;

  if add_staff.role not in ('owner', 'manager', 'cashier', 'kitchen', 'waiter') then
    raise exception 'Invalid role';
  end if;

  if length(add_staff.password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  select u.id into v_user_id
  from public.users u
  where lower(u.email) = lower(add_staff.email);

  if v_user_id is null then
    -- Create the auth user; the on_auth_user_created trigger sees
    -- staff_only=true and skips tenant provisioning.
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      add_staff.email,
      extensions.crypt(add_staff.password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', add_staff.full_name, 'staff_only', 'true'),
      now(), now(), '', '', '', ''
    )
    returning id into v_user_id;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id,
      v_user_id,
      v_user_id::text,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', add_staff.email,
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    );
  else
    update public.users
    set full_name = add_staff.full_name
    where id = v_user_id;
  end if;

  insert into public.staff (restaurant_id, user_id, role, is_active)
  values (v_restaurant_id, v_user_id, add_staff.role, true)
  on conflict (restaurant_id, user_id) do update
    set role = excluded.role,
        is_active = true;
end;
$$;

-- Update staff (role, is_active)
create or replace function public.update_staff(
  staff_id uuid,
  role text default null,
  is_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  select s.restaurant_id into v_restaurant_id
  from public.staff s
  where s.id = update_staff.staff_id
    and s.restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Staff not found or access denied';
  end if;

  if update_staff.role is not null
     and update_staff.role not in ('owner', 'manager', 'cashier', 'kitchen', 'waiter') then
    raise exception 'Invalid role';
  end if;

  update public.staff s
  set role = coalesce(update_staff.role, s.role),
      is_active = coalesce(update_staff.is_active, s.is_active)
  where s.id = update_staff.staff_id;

  if not found then
    raise exception 'Staff not found';
  end if;
end;
$$;

-- Remove staff member
create or replace function public.remove_staff(
  staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_role text;
begin
  select s.restaurant_id, s.role into v_restaurant_id, v_role
  from public.staff s
  where s.id = remove_staff.staff_id
    and s.restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Staff not found or access denied';
  end if;

  if v_role = 'owner' then
    raise exception 'Cannot remove owner';
  end if;

  if (
    select s.user_id from public.staff s
    where s.id = remove_staff.staff_id
  ) = auth.uid() then
    raise exception 'Cannot remove yourself';
  end if;

  delete from public.staff
  where id = remove_staff.staff_id;
end;
$$;

-- Restock ingredient (add to stock)
create or replace function public.restock_ingredient(
  ingredient_id uuid,
  quantity numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  -- Verify ingredient belongs to user's restaurant
  select restaurant_id into v_restaurant_id
  from public.ingredients
  where id = restock_ingredient.ingredient_id
    and restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Ingredient not found or access denied';
  end if;

  if restock_ingredient.quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  update public.ingredients
  set current_stock = current_stock + restock_ingredient.quantity
  where id = restock_ingredient.ingredient_id;

  insert into public.inventory_transactions
    (restaurant_id, ingredient_id, type, quantity, created_by)
  values
    (v_restaurant_id, restock_ingredient.ingredient_id, 'restock',
     restock_ingredient.quantity, auth.uid());
end;
$$;

-- Adjust ingredient (set stock to specific value)
create or replace function public.adjust_ingredient(
  ingredient_id uuid,
  quantity numeric,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_old_stock numeric;
  v_diff numeric;
begin
  -- Verify ingredient belongs to user's restaurant
  select restaurant_id, current_stock into v_restaurant_id, v_old_stock
  from public.ingredients
  where id = adjust_ingredient.ingredient_id
    and restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Ingredient not found or access denied';
  end if;

  if adjust_ingredient.quantity < 0 then
    raise exception 'Quantity cannot be negative';
  end if;

  v_diff := adjust_ingredient.quantity - v_old_stock;

  update public.ingredients
  set current_stock = adjust_ingredient.quantity
  where id = adjust_ingredient.ingredient_id;

  insert into public.inventory_transactions
    (restaurant_id, ingredient_id, type, quantity, reference, created_by)
  values
    (v_restaurant_id, adjust_ingredient.ingredient_id, 'adjustment',
     v_diff, adjust_ingredient.note, auth.uid());
end;
$$;

-- ------------------------------------------------------------------
-- Subscription / Billing RPCs (for admin panel)
-- ------------------------------------------------------------------

-- 2. Subscription payments table
-- ------------------------------------------------------------------
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.businesses (id) on delete cascade,
  amount numeric(12, 2) not null default 0,
  method text not null check (method in (
    'bank_transfer', 'online_bank_transfer', 'mobile_banking',
    'eftpos', 'visa_card', 'cash', 'other')),
  bank text,
  reference text,
  proof_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz
);

alter table public.subscription_payments enable row level security;

drop policy if exists "owners read own subscription payments"
  on public.subscription_payments;
create policy "owners read own subscription payments"
  on public.subscription_payments
  for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = subscription_payments.subscription_id
        and b.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_platform_admin = true
    )
  );

create index if not exists idx_subscription_payments_sub
  on public.subscription_payments (subscription_id);

-- ------------------------------------------------------------------
-- 3. Admin guard helper (used by every privileged RPC below)
-- ------------------------------------------------------------------
create or replace function public.assert_platform_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.users
    where id = auth.uid() and is_platform_admin = true
  ) then
    raise exception 'Forbidden: platform admin only'
      using errcode = '42501';
  end if;
end;
$$;

-- ------------------------------------------------------------------
-- 4. Harden existing admin getters
-- ------------------------------------------------------------------
-- Changing from untyped `setof record` to typed `returns table` requires
-- dropping the old overloads first.
drop function if exists public.get_admin_businesses();
drop function if exists public.get_admin_users();
drop function if exists public.get_admin_overview();
drop function if exists public.get_my_subscription();


create or replace function public.get_admin_users()
returns table (
  id uuid,
  email text,
  full_name text,
  is_platform_admin boolean,
  memberships text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as 
as $$
  select
    u.id,
    u.email,
    u.full_name,
    coalesce(u.memberships, 'No restaurant access'),
    u.created_at
  from public.users u
  order by u.created_at desc;
end;
$$;
