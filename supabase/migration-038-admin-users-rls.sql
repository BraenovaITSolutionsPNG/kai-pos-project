-- Allow platform admins to see all users
drop policy if exists "users platform admin read" on public.users;
create policy "users platform admin read" on public.users
  for select to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and is_platform_admin = true
    )
  );
