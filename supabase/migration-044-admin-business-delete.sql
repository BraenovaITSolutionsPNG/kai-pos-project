-- Migration 044: Allow platform admins to delete businesses.
-- Deleting a business cascades to its restaurants, products, categories,
-- orders, and subscription payments via existing FK constraints.

drop policy if exists "businesses platform admin delete" on public.businesses;
create policy "businesses platform admin delete"
  on public.businesses
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_platform_admin = true
    )
  );
