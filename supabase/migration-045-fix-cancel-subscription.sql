-- Migration 045: Ensure cancel_subscription RPC exists with proper grants.
-- The function was never applied to the database (or was dropped).
-- Note: subscription_id parameter is actually a business id (get_admin_subscriptions
-- returns business.id as the subscription id).

create or replace function public.cancel_subscription(subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  update public.businesses
  set is_active = false,
      current_period_end = now()
  where id = subscription_id;

  if not found then
    raise exception 'Subscription not found';
  end if;
end;
$$;

revoke all on function public.cancel_subscription(uuid) from public, anon;
grant execute on function public.cancel_subscription(uuid) to authenticated;
