-- Year-end close: archive tables for transactional data

create table if not exists public.orders_archive (
  id uuid primary key,
  restaurant_id uuid not null,
  table_id uuid,
  order_number bigint not null,
  status text not null default 'open',
  order_type text not null default 'dine_in',
  subtotal numeric(10, 2) not null default 0,
  tax numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fiscal_year integer
);

create table if not exists public.order_items_archive (
  id uuid primary key,
  order_id uuid not null,
  product_id uuid,
  product_name text not null,
  quantity integer not null,
  unit_price numeric(10, 2) not null,
  notes text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  fiscal_year integer
);

create table if not exists public.payments_archive (
  id uuid primary key,
  order_id uuid not null,
  method text not null,
  amount numeric(10, 2) not null,
  reference text,
  created_at timestamptz not null default now(),
  fiscal_year integer
);

create table if not exists public.expenses_archive (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  category text not null,
  amount numeric(10, 2) not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  fiscal_year integer
);

create table if not exists public.shifts_archive (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  staff_id uuid not null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  scheduled_shift_id uuid,
  created_at timestamptz not null default now(),
  fiscal_year integer
);

create table if not exists public.cashups_archive (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  shift_id uuid,
  cash_total numeric(10, 2) not null default 0,
  eftpos_total numeric(10, 2) not null default 0,
  bank_transfer_total numeric(10, 2) not null default 0,
  refunds numeric(10, 2) not null default 0,
  expenses numeric(10, 2) not null default 0,
  net_sales numeric(10, 2) not null default 0,
  closed_by uuid,
  closed_at timestamptz not null default now(),
  fiscal_year integer
);

create table if not exists public.inventory_transactions_archive (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  ingredient_id uuid not null,
  type text not null,
  quantity numeric(10, 3) not null,
  reference_order_id uuid,
  reference text,
  created_by uuid,
  created_at timestamptz not null default now(),
  fiscal_year integer
);

alter table public.orders_archive enable row level security;
alter table public.order_items_archive enable row level security;
alter table public.payments_archive enable row level security;
alter table public.expenses_archive enable row level security;
alter table public.shifts_archive enable row level security;
alter table public.cashups_archive enable row level security;
alter table public.inventory_transactions_archive enable row level security;

create policy "orders_archive_select" on public.orders_archive for select to authenticated using (true);
create policy "order_items_archive_select" on public.order_items_archive for select to authenticated using (true);
create policy "payments_archive_select" on public.payments_archive for select to authenticated using (true);
create policy "expenses_archive_select" on public.expenses_archive for select to authenticated using (true);
create policy "shifts_archive_select" on public.shifts_archive for select to authenticated using (true);
create policy "cashups_archive_select" on public.cashups_archive for select to authenticated using (true);
create policy "inventory_transactions_archive_select" on public.inventory_transactions_archive for select to authenticated using (true);
