-- Migration 008: staff can read their co-workers' profiles.
-- The /staff page lists every team member's name + email, but the users
-- table is locked to `id = auth.uid()`, so an owner/manager querying the
-- team got empty rows and every member showed as "Unnamed". Allow reading
-- the profiles of anyone who shares one of the caller's restaurants.

drop policy if exists "users visible to co-tenant staff" on public.users;
create policy "users visible to co-tenant staff"
  on public.users
  for select
  to authenticated
  using (
    id in (
      select s2.user_id
      from public.staff s1
      join public.staff s2 on s2.restaurant_id = s1.restaurant_id
      where s1.user_id = auth.uid() and s1.is_active = true
    )
  );
