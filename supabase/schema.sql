-- ============================================================
-- KAI POS â€” Complete Schema (PNG restaurant POS platform)
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
  status text not null default 'open'
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

-- Shifts for staff clock-in/out.
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  staff_id uuid references public.staff (id) on delete cascade not null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
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
     'open', v_subtotal, v_tax, v_total, v_created_by)
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

-- Advance kitchen order status (used by KDS)
create or replace function public.advance_kitchen(
  p_order_id uuid,
  p_action text
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
begin
  -- Validate action
  if p_action not in ('preparing', 'ready', 'served') then
    raise exception 'Invalid action: %', p_action;
  end if;

  -- Get order and verify it belongs to user's restaurant
  select * into v_order
  from public.orders
  where id = p_order_id
    and restaurant_id in (select public.user_restaurant_ids());

  if not found then
    raise exception 'Order not found or access denied';
  end if;

  -- Determine new order status based on action and current item statuses
  case p_action
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

  -- Update order status
  update public.orders
  set status = v_new_status,
      updated_at = now()
  where id = p_order_id;

  -- Update order_items status
  if p_action in ('preparing', 'ready') then
    update public.order_items
    set status = v_item_status
    where order_id = p_order_id
      and status = 'new';

    -- If marking ready, also update any 'preparing' items
    if p_action = 'ready' then
      update public.order_items
      set status = 'ready'
      where order_id = p_order_id
        and status = 'preparing';
    end if;
  end if;

  -- If served, mark all items as ready
  if p_action = 'served' then
    update public.order_items
    set status = 'ready'
    where order_id = p_order_id;
  end if;
end;
$$;

-- Add staff member (creates auth user + staff record)
create or replace function public.add_staff(
  p_email text,
  p_full_name text,
  p_password text,
  p_role text
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
  -- Get current user's restaurant
  select restaurant_id into v_restaurant_id
  from public.staff
  where user_id = auth.uid() and is_active = true
  limit 1;

  if v_restaurant_id is null then
    raise exception 'No active restaurant found for current user';
  end if;

  -- Check if user already exists
  select id into v_user_id
  from public.users
  where email = p_email;

  if v_user_id is not null then
    -- User exists, just add staff record
    insert into public.staff (restaurant_id, user_id, role, is_active)
    values (v_restaurant_id, v_user_id, p_role, true)
    on conflict (restaurant_id, user_id) do update
      set role = p_role, is_active = true;
    return;
  end if;

  -- Create auth user (this will trigger handle_new_user, but we catch it)
  -- We need to create the user in auth.users first
  -- Since we can't call auth.sign_up from here, we create the user record
  -- and the admin will need to invite them, OR we use a different approach.
  
  -- For now, create the user profile and staff record.
  -- The actual auth user creation should happen via admin invite flow.
  -- This RPC assumes the user already exists in auth.users.
  
  v_user_id := gen_random_uuid();
  
  insert into public.users (id, email, full_name)
  values (v_user_id, p_email, p_full_name)
  on conflict (id) do nothing;

  insert into public.staff (restaurant_id, user_id, role, is_active)
  values (v_restaurant_id, v_user_id, p_role, true)
  on conflict (restaurant_id, user_id) do update
    set role = p_role, is_active = true;
end;
$$;

-- Update staff (role, is_active)
create or replace function public.update_staff(
  p_staff_id uuid,
  p_role text default null,
  p_is_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  -- Verify staff belongs to user's restaurant
  select restaurant_id into v_restaurant_id
  from public.staff
  where id = p_staff_id
    and restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Staff not found or access denied';
  end if;

  -- Prevent removing owner role
  if p_role = 'owner' then
    raise exception 'Cannot change role to owner via this function';
  end if;

  update public.staff
  set role = coalesce(p_role, role),
      is_active = coalesce(p_is_active, is_active)
  where id = p_staff_id;
end;
$$;

-- Remove staff member
create or replace function public.remove_staff(
  p_staff_id uuid
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
  -- Verify staff belongs to user's restaurant
  select restaurant_id, role into v_restaurant_id, v_role
  from public.staff
  where id = p_staff_id
    and restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Staff not found or access denied';
  end if;

  -- Prevent removing owner
  if v_role = 'owner' then
    raise exception 'Cannot remove owner';
  end if;

  -- Prevent removing self
  if (select user_id from public.staff where id = p_staff_id) = auth.uid() then
    raise exception 'Cannot remove yourself';
  end if;

  delete from public.staff where id = p_staff_id;
end;
$$;

-- Restock ingredient (add to stock)
create or replace function public.restock_ingredient(
  p_ingredient_id uuid,
  p_quantity numeric
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
  where id = p_ingredient_id
    and restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Ingredient not found or access denied';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  update public.ingredients
  set current_stock = current_stock + p_quantity
  where id = p_ingredient_id;

  insert into public.inventory_transactions
    (restaurant_id, ingredient_id, type, quantity, created_by)
  values
    (v_restaurant_id, p_ingredient_id, 'restock', p_quantity, auth.uid());
end;
$$;

-- Adjust ingredient (set stock to specific value)
create or replace function public.adjust_ingredient(
  p_ingredient_id uuid,
  p_quantity numeric,
  p_note text default null
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
  where id = p_ingredient_id
    and restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Ingredient not found or access denied';
  end if;

  if p_quantity < 0 then
    raise exception 'Quantity cannot be negative';
  end if;

  v_diff := p_quantity - v_old_stock;

  update public.ingredients
  set current_stock = p_quantity
  where id = p_ingredient_id;

  insert into public.inventory_transactions
    (restaurant_id, ingredient_id, type, quantity, reference, created_by)
  values
    (v_restaurant_id, p_ingredient_id, 'adjustment', v_diff, p_note, auth.uid());
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
drop function if exists public.get_my_payments();
drop function if exists public.get_admin_subscriptions();
drop function if exists public.get_admin_subscription_payments(uuid);

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
drop function if exists public.get_my_payments();
drop function if exists public.get_admin_subscriptions();
drop function if exists public.get_admin_subscription_payments(uuid);

create or replace function public.get_admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.assert_platform_admin();
  select jsonb_build_object(
    'businesses', (select count(*) from public.businesses),
    'active_businesses', (select count(*) from public.businesses where is_active = true),
    'restaurants', (select count(*) from public.restaurants),
    'users', (select count(*) from public.users),
    'platform_admins', (select count(*) from public.users where is_platform_admin = true),
    'staff', (select count(*) from public.staff where is_active = true),
    'orders', (select count(*) from public.orders),
    'revenue', (select coalesce(sum(total), 0) from public.orders where status = 'paid')
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_admin_businesses()
returns table (
  id uuid,
  name text,
  owner_id uuid,
  owner_email text,
  plan text,
  is_active boolean,
  restaurant_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  return query
  select
    b.id,
    b.name,
    b.owner_id,
    u.email,
    b.plan,
    b.is_active,
    (select count(*) from public.restaurants r where r.business_id = b.id),
    b.created_at
  from public.businesses b
  left join public.users u on u.id = b.owner_id
  order by b.created_at desc;
end;
$$;

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
as $$
begin
  perform public.assert_platform_admin();
  return query
  select
    u.id,
    u.email,
    u.full_name,
    u.is_platform_admin,
    u.memberships,
    u.created_at
  from public.users u
  order by u.created_at desc;
end;
$$;

-- ------------------------------------------------------------------
-- 5. Subscription reads (replace placeholders with real data)
-- ------------------------------------------------------------------
create or replace function public.get_my_subscription()
returns table (
  id uuid,
  plan text,
  billing_cycle text,
  price numeric,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  business_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_business_id uuid;
begin
  select restaurant_id into v_restaurant_id
  from public.staff
  where user_id = auth.uid() and is_active = true
  limit 1;

  if v_restaurant_id is null then
    return;
  end if;

  select business_id into v_business_id
  from public.restaurants r
  where r.id = v_restaurant_id;

  return query
  select
    b.id,
    b.plan,
    b.billing_cycle,
    case b.billing_cycle
      when 'annual' then
        case b.plan
          when 'business' then 15000::numeric
          when 'professional' then 25000::numeric
          else 5000::numeric
        end
      else
        case b.plan
          when 'business' then 1500::numeric
          when 'professional' then 2500::numeric
          else 500::numeric
        end
    end,
    case when b.is_active then 'active' else 'pending' end,
    b.created_at,
    coalesce(
      b.current_period_end,
      b.created_at + case b.billing_cycle
        when 'annual' then interval '1 year' else interval '1 month' end
    ),
    r.name
  from public.businesses b
  join public.restaurants r on r.business_id = b.id
  where b.id = v_business_id;
end;
$$;

create or replace function public.get_my_payments()
returns table (
  id uuid,
  subscription_id uuid,
  amount numeric,
  method text,
  bank text,
  reference text,
  proof_url text,
  status text,
  created_at timestamptz,
  approved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    sp.id,
    sp.subscription_id,
    sp.amount,
    sp.method,
    sp.bank,
    sp.reference,
    sp.proof_url,
    sp.status,
    sp.created_at,
    sp.approved_at
  from public.subscription_payments sp
  join public.businesses b on b.id = sp.subscription_id
  where b.owner_id = auth.uid()
  order by sp.created_at desc;
end;
$$;

create or replace function public.get_admin_subscriptions()
returns table (
  id uuid,
  business_name text,
  owner_email text,
  plan text,
  billing_cycle text,
  price numeric,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  days_left int,
  pending_payments bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  return query
  select
    b.id,
    b.name,
    u.email,
    b.plan,
    b.billing_cycle,
    case b.billing_cycle
      when 'annual' then
        case b.plan
          when 'business' then 15000::numeric
          when 'professional' then 25000::numeric
          else 5000::numeric
        end
      else
        case b.plan
          when 'business' then 1500::numeric
          when 'professional' then 2500::numeric
          else 500::numeric
        end
    end,
    case when b.is_active then 'active' else 'pending' end,
    b.created_at,
    coalesce(
      b.current_period_end,
      b.created_at + case b.billing_cycle
        when 'annual' then interval '1 year' else interval '1 month' end
    ),
    greatest(
      0,
      ceil(extract(epoch from (
        coalesce(
          b.current_period_end,
          b.created_at + case b.billing_cycle
            when 'annual' then interval '1 year' else interval '1 month' end
        ) - now()
      )) / 86400.0)
    )::int,
    (select count(*) from public.subscription_payments sp
      where sp.subscription_id = b.id and sp.status = 'pending')
  from public.businesses b
  left join public.users u on u.id = b.owner_id
  order by b.created_at desc;
end;
$$;

create or replace function public.get_admin_subscription_payments(p_subscription_id uuid)
returns table (
  id uuid,
  subscription_id uuid,
  amount numeric,
  method text,
  bank text,
  reference text,
  proof_url text,
  status text,
  created_by_email text,
  created_at timestamptz,
  approved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  return query
  select
    sp.id,
    sp.subscription_id,
    sp.amount,
    sp.method,
    sp.bank,
    sp.reference,
    sp.proof_url,
    sp.status,
    cu.email,
    sp.created_at,
    sp.approved_at
  from public.subscription_payments sp
  left join public.users cu on cu.id = sp.created_by
  where sp.subscription_id = p_subscription_id
  order by sp.created_at desc;
end;
$$;

-- ------------------------------------------------------------------
-- 6. Payment workflow RPCs (the ones the UI calls)
-- ------------------------------------------------------------------

-- Owner submits proof of payment for their own business.
create or replace function public.submit_payment(
  method text,
  bank text default null,
  reference text default null,
  amount numeric default null,
  proof_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_price numeric;
begin
  select r.business_id into v_business_id
  from public.staff s
  join public.restaurants r on r.id = s.restaurant_id
  where s.user_id = auth.uid() and s.is_active = true
  limit 1;

  if v_business_id is null then
    raise exception 'No business found for your account';
  end if;

  select case b.billing_cycle
    when 'annual' then
      case b.plan when 'business' then 15000 when 'professional' then 25000 else 5000 end
    else
      case b.plan when 'business' then 1500 when 'professional' then 2500 else 500 end
  end
  into v_price
  from public.businesses b
  where b.id = v_business_id;

  insert into public.subscription_payments
    (subscription_id, amount, method, bank, reference, proof_url, status, created_by)
  values
    (v_business_id,
     coalesce(submit_payment.amount, v_price),
     submit_payment.method,
     submit_payment.bank,
     submit_payment.reference,
     submit_payment.proof_url,
     'pending',
     auth.uid());
end;
$$;

-- Admin records an offline payment on behalf of a business.
create or replace function public.record_subscription_payment(
  subscription_id uuid,
  amount numeric,
  method text,
  bank text default null,
  reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();
  insert into public.subscription_payments
    (subscription_id, amount, method, bank, reference, status, created_by)
  values
    (record_subscription_payment.subscription_id,
     record_subscription_payment.amount,
     record_subscription_payment.method,
     record_subscription_payment.bank,
     record_subscription_payment.reference,
     'pending',
     auth.uid());
end;
$$;

-- Admin approves a payment -> activate/renew the business.
create or replace function public.approve_subscription_payment(
  payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_cycle text;
  v_plan text;
begin
  perform public.assert_platform_admin();

  update public.subscription_payments
  set status = 'approved',
      reviewed_by = auth.uid(),
      approved_at = now()
  where id = approve_subscription_payment.payment_id
    and status = 'pending';

  if not found then
    raise exception 'Payment not found or already reviewed';
  end if;

  select b.id, b.billing_cycle, b.plan
  into v_business_id, v_cycle, v_plan
  from public.subscription_payments sp
  join public.businesses b on b.id = sp.subscription_id
  where sp.id = approve_subscription_payment.payment_id;

  update public.businesses
  set is_active = true,
      current_period_end = now() + case v_cycle
        when 'annual' then interval '1 year' else interval '1 month' end
  where id = v_business_id;

  insert into public.notifications (user_id, message, link)
  values (
    (select owner_id from public.businesses where id = v_business_id),
    'Your payment was approved. Your subscription is now active â€” welcome aboard!',
    '/dashboard'
  );
end;
$$;

-- Admin rejects a payment proof.
create or replace function public.reject_subscription_payment(
  payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  update public.subscription_payments
  set status = 'rejected',
      reviewed_by = auth.uid()
  where id = reject_subscription_payment.payment_id
    and status = 'pending';

  if not found then
    raise exception 'Payment not found or already reviewed';
  end if;

  insert into public.notifications (user_id, message, link)
  select b.owner_id,
         'Your payment proof could not be verified. Please resubmit from the subscription page.',
         '/subscription'
  from public.businesses b
  join public.subscription_payments sp on sp.subscription_id = b.id
  where sp.id = reject_subscription_payment.payment_id;
end;
$$;

-- Admin edits plan / billing cycle; resets the period from today.
create or replace function public.update_subscription(
  subscription_id uuid,
  plan text,
  billing_cycle text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  if billing_cycle not in ('monthly', 'annual') then
    raise exception 'Invalid billing cycle';
  end if;
  if plan not in ('starter', 'business', 'professional') then
    raise exception 'Invalid plan';
  end if;

  update public.businesses
  set plan = update_subscription.plan,
      billing_cycle = update_subscription.billing_cycle,
      current_period_end = now() + case update_subscription.billing_cycle
        when 'annual' then interval '1 year' else interval '1 month' end
  where id = update_subscription.subscription_id;

  if not found then
    raise exception 'Subscription not found';
  end if;
end;
$$;

-- Admin nudges an owner to pay: drops a notification in their bell.
create or replace function public.send_reminder(
  subscription_id uuid,
  message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  perform public.assert_platform_admin();

  select owner_id into v_owner
  from public.businesses
  where id = send_reminder.subscription_id;

  if v_owner is null then
    raise exception 'Business not found';
  end if;

  insert into public.notifications (user_id, message, link)
  values (v_owner, send_reminder.message, '/subscription');
end;
$$;


-- Migration 003: notifications + site content RPCs.
-- Restores get_notifications/get_site_content as typed functions
-- (PostgREST cannot call untyped `setof record`) and adds the two
-- RPCs the UI calls that never existed in the database.

drop function if exists public.get_notifications();
drop function if exists public.get_site_content();

create or replace function public.get_notifications()
returns table (
  id uuid,
  message text,
  link text,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    n.id,
    n.message,
    n.link,
    n.read_at,
    n.created_at
  from public.notifications n
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 50;
end;
$$;

create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;
$$;

create or replace function public.get_site_content()
returns table (
  id uuid,
  value jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    sc.id,
    sc.value
  from public.site_content sc
  order by sc.key;
end;
$$;

create or replace function public.update_site_content(
  items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  perform public.assert_platform_admin();

  for v_item in select * from jsonb_array_elements(update_site_content.items)
  loop
    update public.site_content
    set value = v_item -> 'value'
    where id = (v_item ->> 'id')::uuid;
  end loop;
end;
$$;


create or replace function public.get_my_restaurant_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  select restaurant_id into v_restaurant_id
  from public.staff
  where user_id = auth.uid() and is_active = true
  limit 1;
  return v_restaurant_id;
end;
$$;

-- Clock in for shift
create or replace function public.clock_in()
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
    raise exception 'No active staff record found';
  end if;

  -- Check if already clocked in
  if exists (
    select 1 from public.shifts
    where staff_id = v_staff_id and clock_out is null
  ) then
    raise exception 'Already clocked in';
  end if;

  insert into public.shifts (restaurant_id, staff_id, clock_in)
  select restaurant_id, v_staff_id, now()
  from public.staff
  where id = v_staff_id
  returning * into v_shift;

  return v_shift;
end;
$$;

-- Clock out for shift
create or replace function public.clock_out()
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
    raise exception 'No active staff record found';
  end if;

  update public.shifts
  set clock_out = now()
  where staff_id = v_staff_id and clock_out is null
  returning * into v_shift;

  if v_shift is null then
    raise exception 'No active shift found';
  end if;

  return v_shift;
end;
$$;

-- Get active shift for current user
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
  where staff_id = v_staff_id and clock_out is null
  order by clock_in desc
  limit 1;

  return v_shift;
end;
$$;

-- ------------------------------------------------------------------
-- Realtime publication (for KDS, tables, etc.)
-- ------------------------------------------------------------------

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.tables;
alter publication supabase_realtime add table public.inventory_transactions;


