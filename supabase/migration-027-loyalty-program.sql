-- Migration: Loyalty program settings and points management
-- Adds loyalty configuration to restaurants and points transaction history

-- Add loyalty settings to restaurants
alter table public.restaurants
  add column if not exists loyalty_enabled boolean not null default false,
  add column if not exists loyalty_points_per_kina numeric(10, 2) not null default 1.0,
  add column if not exists loyalty_kina_per_point numeric(10, 2) not null default 1.0,
  add column if not exists loyalty_min_points_redeem integer not null default 100;

comment on column public.restaurants.loyalty_enabled is 'Enable loyalty program for this restaurant';
comment on column public.restaurants.loyalty_points_per_kina is 'Points earned per Kina spent (e.g., 1.0 = 1 point per K1)';
comment on column public.restaurants.loyalty_kina_per_point is 'Kina value per point when redeeming (e.g., 1.0 = 1 point = K1)';
comment on column public.restaurants.loyalty_min_points_redeem is 'Minimum points required for redemption';

-- Loyalty points transactions history
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade not null,
  customer_id uuid references public.customers (id) on delete cascade not null,
  order_id uuid references public.orders (id) on delete set null,
  type text not null check (type in ('earned', 'redeemed', 'expired', 'adjusted', 'bonus')),
  points integer not null,
  balance_after integer not null,
  description text,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_loyalty_transactions_customer on public.loyalty_transactions (customer_id);
create index if not exists idx_loyalty_transactions_restaurant on public.loyalty_transactions (restaurant_id);
create index if not exists idx_loyalty_transactions_order on public.loyalty_transactions (order_id);

alter table public.loyalty_transactions enable row level security;

create policy "loyalty select" on public.loyalty_transactions
  for select using (
    restaurant_id in (
      select restaurant_id from public.staff where user_id = auth.uid() and is_active = true
    )
  );

create policy "loyalty insert" on public.loyalty_transactions
  for insert with check (
    restaurant_id in (
      select restaurant_id from public.staff where user_id = auth.uid() and is_active = true
    )
  );

-- Function to award loyalty points for an order
create or replace function public.award_loyalty_points(
  p_order_id uuid,
  p_customer_id uuid,
  p_amount_kina numeric
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_points_per_kina numeric(10,2);
  v_points integer;
  v_new_balance integer;
begin
  -- Get restaurant and loyalty settings
  select r.id, r.loyalty_points_per_kina
  into v_restaurant_id, v_points_per_kina
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_order_id;

  if not found then
    return 0;
  end if;

  if not (select loyalty_enabled from public.restaurants where id = v_restaurant_id) then
    return 0;
  end if;

  -- Calculate points
  v_points := floor(p_amount_kina * v_points_per_kina);
  if v_points <= 0 then
    return 0;
  end if;

  -- Update customer balance
  update public.customers
  set loyalty_points = loyalty_points + v_points
  where id = p_customer_id
  returning loyalty_points into v_new_balance;

  if not found then
    return 0;
  end if;

  -- Record transaction
  insert into public.loyalty_transactions
    (restaurant_id, customer_id, order_id, type, points, balance_after, description)
  values
    (v_restaurant_id, p_customer_id, p_order_id, 'earned', v_points, v_new_balance, 
     'Earned from order #' || (select order_number from public.orders where id = p_order_id));

  return v_points;
end;
$$;

grant execute on function public.award_loyalty_points(uuid, uuid, numeric) to authenticated;

-- Function to redeem loyalty points
create or replace function public.redeem_loyalty_points(
  p_customer_id uuid,
  p_points integer,
  p_order_id uuid default null,
  p_description text default 'Redemption'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers;
  v_restaurant_id uuid;
  v_kina_per_point numeric(10,2);
  v_min_points integer;
  v_new_balance integer;
begin
  select c.*, r.loyalty_kina_per_point, r.loyalty_min_points_redeem, r.id
  into v_customer, v_kina_per_point, v_min_points, v_restaurant_id
  from public.customers c
  join public.restaurants r on r.id = c.restaurant_id
  where c.id = p_customer_id;

  if not found then
    return false;
  end if;

  if not (select loyalty_enabled from public.restaurants where id = v_restaurant_id) then
    return false;
  end if;

  if p_points < v_min_points then
    return false;
  end if;

  if v_customer.loyalty_points < p_points then
    return false;
  end if;

  -- Update customer balance
  update public.customers
  set loyalty_points = loyalty_points - p_points
  where id = p_customer_id
  returning loyalty_points into v_new_balance;

  -- Record transaction
  insert into public.loyalty_transactions
    (restaurant_id, customer_id, order_id, type, points, balance_after, description)
  values
    (v_restaurant_id, p_customer_id, p_order_id, 'redeemed', -p_points, v_new_balance, p_description);

  return true;
end;
$$;

grant execute on function public.redeem_loyalty_points(uuid, integer, uuid, text) to authenticated;

-- Function to adjust loyalty points (manual adjustment)
create or replace function public.adjust_loyalty_points(
  p_customer_id uuid,
  p_points integer,
  p_description text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers;
  v_restaurant_id uuid;
  v_new_balance integer;
begin
  select c.*, r.id
  into v_customer, v_restaurant_id
  from public.customers c
  join public.restaurants r on r.id = c.restaurant_id
  where c.id = p_customer_id;

  if not found then
    return false;
  end if;

  if v_customer.loyalty_points + p_points < 0 then
    return false;
  end if;

  update public.customers
  set loyalty_points = loyalty_points + p_points
  where id = p_customer_id
  returning loyalty_points into v_new_balance;

  insert into public.loyalty_transactions
    (restaurant_id, customer_id, type, points, balance_after, description)
  values
    (v_restaurant_id, p_customer_id, 'adjusted', p_points, v_new_balance, p_description);

  return true;
end;
$$;

grant execute on function public.adjust_loyalty_points(uuid, integer, text) to authenticated;