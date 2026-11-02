-- Cancel subscription RPC
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
