-- Migration 046: Add delete_business RPC for platform admins.
-- Uses security definer to bypass RLS since the browser/API client
-- may not properly propagate auth context for DELETE operations.

create or replace function public.delete_business(business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_platform_admin();

  delete from public.businesses where id = business_id;

  if not found then
    raise exception 'Business not found';
  end if;
end;
$$;

revoke all on function public.delete_business(uuid) from public, anon;
grant execute on function public.delete_business(uuid) to authenticated;
