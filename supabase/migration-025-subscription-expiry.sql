-- Migration 025: Fix subscription expiry detection.
--
-- The `get_my_subscription` and `get_admin_subscriptions` RPCs previously
-- returned 'active' for any business where is_active = true, even when
-- current_period_end had already passed.  This migration:
--
--   1. Replaces get_my_subscription so it returns 'expired' when the period
--      has ended (current_period_end < now()), even if is_active is still
--      true in the DB.
--   2. Replaces get_admin_subscriptions similarly.
--   3. Adds a helper function compute_subscription_status used by both.
-- ---------------------------------------------------------------------------

-- Helper: derive real status from DB columns
create or replace function public.compute_subscription_status(
  p_is_active boolean,
  p_current_period_end timestamptz,
  p_created_at timestamptz,
  p_billing_cycle text
)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select case
    when not p_is_active then 'pending'
    when coalesce(
      p_current_period_end,
      p_created_at + case p_billing_cycle
        when 'annual' then interval '1 year' else interval '1 month' end
    ) < now() then 'expired'
    else 'active'
  end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_subscription — owner-facing: what plan / status am I on?
-- ---------------------------------------------------------------------------
drop function if exists public.get_my_subscription();
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
  v_business_id   uuid;
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
    end as price,
    public.compute_subscription_status(b.is_active, b.current_period_end, b.created_at, b.billing_cycle) as status,
    b.created_at as current_period_start,
    coalesce(
      b.current_period_end,
      b.created_at + case b.billing_cycle
        when 'annual' then interval '1 year' else interval '1 month' end
    ) as current_period_end,
    r.name as business_name
  from public.businesses b
  join public.restaurants r on r.business_id = b.id
  where b.id = v_business_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_admin_subscriptions — admin-facing: list all businesses + status
-- ---------------------------------------------------------------------------
drop function if exists public.get_admin_subscriptions();
create or replace function public.get_admin_subscriptions()
returns table (
  id uuid,
  name text,
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
    end as price,
    public.compute_subscription_status(b.is_active, b.current_period_end, b.created_at, b.billing_cycle) as status,
    b.created_at as current_period_start,
    coalesce(
      b.current_period_end,
      b.created_at + case b.billing_cycle
        when 'annual' then interval '1 year' else interval '1 month' end
    ) as current_period_end,
    greatest(
      0,
      ceil(extract(epoch from (
        coalesce(
          b.current_period_end,
          b.created_at + case b.billing_cycle
            when 'annual' then interval '1 year' else interval '1 month' end
        ) - now()
      )) / 86400.0)
    )::int as days_left,
    (select count(*) from public.subscription_payments sp
      where sp.subscription_id = b.id and sp.status = 'pending') as pending_payments
  from public.businesses b
  left join public.users u on u.id = b.owner_id
  order by b.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: mark businesses whose period has expired as inactive so that
-- the existing is_active-based logic also correctly gates access until the
-- new get_my_subscription RPC is fully propagated.
-- ---------------------------------------------------------------------------
update public.businesses
set is_active = false
where is_active = true
  and current_period_end is not null
  and current_period_end < now();
