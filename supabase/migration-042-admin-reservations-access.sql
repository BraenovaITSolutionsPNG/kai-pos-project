-- Restore a database-side authorization check for admin user enumeration.
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
$$;

revoke all on function public.get_admin_users() from public, anon;
grant execute on function public.get_admin_users() to authenticated;

-- Reservations are an internal staff workflow. Keep every operation within
-- restaurants where the signed-in user has an active staff membership.
drop policy if exists "reservations_select" on public.reservations;
drop policy if exists "reservations_insert" on public.reservations;
drop policy if exists "reservations_update" on public.reservations;
drop policy if exists "reservations_delete" on public.reservations;

create policy "reservations_select"
  on public.reservations
  for select to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));

create policy "reservations_insert"
  on public.reservations
  for insert to authenticated
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "reservations_update"
  on public.reservations
  for update to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()))
  with check (restaurant_id in (select public.user_restaurant_ids()));

create policy "reservations_delete"
  on public.reservations
  for delete to authenticated
  using (restaurant_id in (select public.user_restaurant_ids()));
