-- Fix get_admin_users RPC - remove assert_platform_admin (app handles auth)
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
begin
  return query
  select
    u.id,
    u.email,
    u.full_name,
    u.is_platform_admin,
    coalesce((
      select string_agg(r.name, ', ')
      from public.staff s
      join public.restaurants r on r.id = s.restaurant_id
      where s.user_id = u.id
    ), 'No restaurant access') as memberships,
    u.created_at
  from public.users u
  order by u.created_at desc;
end;
;
