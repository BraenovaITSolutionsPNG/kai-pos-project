-- Migration 007: platform admin write access.
-- The admin console updates businesses (plan / suspend) and users
-- (promote/demote platform admin) with direct table writes, but RLS only
-- granted row access to owners/staff, so the UPDATEs matched zero rows and
-- silently did nothing. These policies let real platform admins perform the
-- same writes; everything else stays restaurant-scoped.

drop policy if exists "businesses platform admin manage" on public.businesses;
create policy "businesses platform admin manage"
  on public.businesses
  for update
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_platform_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_platform_admin = true
    )
  );

drop policy if exists "users platform admin manage" on public.users;
create policy "users platform admin manage"
  on public.users
  for update
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_platform_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_platform_admin = true
    )
  );
