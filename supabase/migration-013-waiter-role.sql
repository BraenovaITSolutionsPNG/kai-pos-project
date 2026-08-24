-- Migration 013: add the 'waiter' staff role
-- The staff.role column has a CHECK constraint and both staff RPCs
-- validate the role literally, so all three must be updated for 'waiter'
-- to be a usable role.

alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff
  add constraint staff_role_check
  check (role in ('owner', 'manager', 'cashier', 'kitchen', 'waiter'));

-- Recreate add_staff with the waiter role allowed.
create or replace function public.add_staff(
  email text,
  full_name text,
  password text,
  role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_restaurant_id uuid;
begin
  select restaurant_id into v_restaurant_id
  from public.staff
  where user_id = auth.uid() and is_active = true
  limit 1;

  if v_restaurant_id is null then
    raise exception 'No active restaurant found for current user';
  end if;

  if add_staff.role not in ('owner', 'manager', 'cashier', 'kitchen', 'waiter') then
    raise exception 'Invalid role';
  end if;

  if length(add_staff.password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  select u.id into v_user_id
  from public.users u
  where lower(u.email) = lower(add_staff.email);

  if v_user_id is null then
    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      add_staff.email,
      extensions.crypt(add_staff.password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', add_staff.full_name, 'staff_only', 'true'),
      now(), now(), '', '', '', ''
    )
    returning id into v_user_id;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id,
      v_user_id,
      v_user_id::text,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', add_staff.email,
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    );
  else
    update public.users
    set full_name = add_staff.full_name
    where id = v_user_id;
  end if;

  insert into public.staff (restaurant_id, user_id, role, is_active)
  values (v_restaurant_id, v_user_id, add_staff.role, true)
  on conflict (restaurant_id, user_id) do update
    set role = excluded.role,
        is_active = true;
end;
$$;

-- Recreate update_staff with the waiter role allowed.
create or replace function public.update_staff(
  staff_id uuid,
  role text default null,
  is_active boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  select s.restaurant_id into v_restaurant_id
  from public.staff s
  where s.id = update_staff.staff_id
    and s.restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Staff not found or access denied';
  end if;

  if update_staff.role is not null
     and update_staff.role not in ('owner', 'manager', 'cashier', 'kitchen', 'waiter') then
    raise exception 'Invalid role';
  end if;

  update public.staff s
  set role = coalesce(update_staff.role, s.role),
      is_active = coalesce(update_staff.is_active, s.is_active)
  where s.id = update_staff.staff_id;

  if not found then
    raise exception 'Staff not found';
  end if;
end;
$$;
