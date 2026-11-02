-- Add memberships column to users and fix get_admin_users RPC
alter table public.users add column if not exists memberships text;

-- Update memberships for all users based on staff records
update public.users u
set memberships = (
  select string_agg(r.name, ', ')
  from public.staff s
  join public.restaurants r on r.id = s.restaurant_id
  where s.user_id = u.id
);

-- Set first user as platform admin (for admin access)
update public.users
set is_platform_admin = true
where email = 'joelnamuri005@gmail.com';

-- Fix get_admin_users RPC to compute memberships
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
  perform public.assert_platform_admin();
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
    ), 'No businesses') as memberships,
    u.created_at
  from public.users u
  order by u.created_at desc;
end;
;
