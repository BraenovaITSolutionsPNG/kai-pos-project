-- Migration: Multi-branch owner dashboard RPC
-- Returns all restaurants for a business with today's stats

create or replace function public.get_business_restaurants(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurants jsonb;
  v_today date := current_date;
begin
  -- Verify the caller owns this business (is owner or has staff in one of its restaurants)
  if not exists (
    select 1 from public.restaurants r
    join public.staff s on s.restaurant_id = r.id
    where r.business_id = p_business_id
      and s.user_id = auth.uid()
      and s.is_active = true
      and s.role in ('owner', 'manager')
  ) then
    return jsonb_build_object('error', 'Not authorized to view this business');
  end if;

  select jsonb_agg(r order by r.created_at) into v_restaurants
  from (
    select
      r.id,
      r.name,
      r.address,
      r.currency,
      r.logo_url,
      r.created_at,
      coalesce(o.today_orders, 0) as today_orders,
      coalesce(o.today_revenue, 0) as today_revenue,
      coalesce(s.active_shifts, 0) as active_shifts
    from public.restaurants r
    left join lateral (
      select
        count(*) as today_orders,
        sum(case when status = 'paid' then total else 0 end) as today_revenue
      from public.orders
      where restaurant_id = r.id
        and created_at >= v_today
        and created_at < v_today + interval '1 day'
    ) o on true
    left join lateral (
      select count(*) as active_shifts
      from public.shifts
      where restaurant_id = r.id
        and clock_out is null
    ) s on true
    where r.business_id = p_business_id
  ) r;

  return coalesce(v_restaurants, '[]'::jsonb);
end;
$$;

grant execute on function public.get_business_restaurants(uuid) to authenticated;