-- Migration 002: real subscription payments flow.
-- Adds the missing payments table + RPCs the UI already calls, makes
-- placeholder getters read real data, hardens admin RPCs, and starts new
-- businesses inactive (unpaid) so owners land on /subscription first.

-- ------------------------------------------------------------------
-- 1. Businesses: billing cycle + period tracking
-- ------------------------------------------------------------------
alter table public.businesses
  add column if not exists billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'annual')),
  add column if not exists current_period_end timestamptz;

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
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
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

-- ------------------------------------------------------------------
-- 7. Signup provisioning: chosen plan + start unpaid (gated)
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
  values (v_business_id, v_business_name || ' — Main', '', 'PGK')
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
