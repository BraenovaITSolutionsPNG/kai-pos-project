-- Migration 005: staff management RPCs.
-- The UI called add_staff/update_staff/remove_staff/advance_kitchen with
-- (email, full_name, password, role / staff_id / order_id, action) but the
-- database used p_-prefixed overloads -> PostgREST "not found in schema
-- cache". Worse, add_staff never created an auth user, so new staff could
-- not log in at all. These versions match the UI's argument names and
-- provision real, password-backed logins.

-- Password hashing for staff accounts created inside the database.
create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------------
-- 1. Signup trigger: admin-created staff must not get a business.
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_restaurant_id uuid;
  v_food uuid;
  v_drinks uuid;
  v_snacks uuid;
  v_desserts uuid;
  v_full_name text := new.raw_user_meta_data ->> 'full_name';
  v_business_name text := new.raw_user_meta_data ->> 'business_name';
  v_plan text := coalesce(nullif(new.raw_user_meta_data ->> 'plan', ''), 'starter');
begin
  -- Staff accounts created via add_staff() only need a profile row;
  -- they belong to their employer's restaurant, not their own tenant.
  if coalesce(new.raw_user_meta_data ->> 'staff_only', '') = 'true' then
    insert into public.users (id, email, full_name)
    values (
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'full_name'
    )
    on conflict (id) do nothing;
    return new;
  end if;

  if v_plan not in ('starter', 'business', 'professional') then
    v_plan := 'starter';
  end if;

  v_full_name := coalesce(nullif(v_full_name, ''), new.email);
  v_business_name := coalesce(nullif(v_business_name, ''), v_full_name || '''s Cafe');

  insert into public.users (id, email, full_name)
  values (new.id, new.email, v_full_name);

  -- Businesses start INACTIVE: the owner must submit a payment that an
  -- admin approves before the dashboard unlocks.
  insert into public.businesses (name, owner_id, plan, is_active)
  values (v_business_name, new.id, v_plan, false)
  returning id into v_business_id;

  insert into public.restaurants (business_id, name, address, currency)
  values (v_business_id, v_business_name || ' — Main', '', 'PGK')
  returning id into v_restaurant_id;

  insert into public.staff (restaurant_id, user_id, role, is_active)
  values (v_restaurant_id, new.id, 'owner', true);

  -- A starter menu so the POS is ready once activated.
  insert into public.categories (restaurant_id, name, sort_order) values
    (v_restaurant_id, 'Food', 1),
    (v_restaurant_id, 'Drinks', 2),
    (v_restaurant_id, 'Snacks', 3),
    (v_restaurant_id, 'Desserts', 4);

  select id into v_food from public.categories
    where restaurant_id = v_restaurant_id and name = 'Food';
  select id into v_drinks from public.categories
    where restaurant_id = v_restaurant_id and name = 'Drinks';
  select id into v_snacks from public.categories
    where restaurant_id = v_restaurant_id and name = 'Snacks';
  select id into v_desserts from public.categories
    where restaurant_id = v_restaurant_id and name = 'Desserts';

  insert into public.products
    (restaurant_id, category_id, name, price, sort_order) values
    (v_restaurant_id, v_food,    'Chicken Fried Rice',        25.00, 1),
    (v_restaurant_id, v_food,    'Fish & Chips',              32.00, 2),
    (v_restaurant_id, v_food,    'Chicken Steak',             38.00, 3),
    (v_restaurant_id, v_food,    'BBQ Pork Ribs',             42.00, 4),
    (v_restaurant_id, v_drinks,  'Coca-Cola (330ml)',          5.50, 1),
    (v_restaurant_id, v_drinks,  'Fresh Water (1.5L)',         5.00, 2),
    (v_restaurant_id, v_drinks,  'Mango Juice',                8.00, 3),
    (v_restaurant_id, v_snacks,  'Crisps',                     4.00, 1),
    (v_restaurant_id, v_snacks,  'Chicken Roll',              12.00, 2),
    (v_restaurant_id, v_desserts,'Ice Cream Sundae',           8.00, 1);

  return new;
end;
$$;

-- ------------------------------------------------------------------
-- 2. Drop the old p_* overloads so PostgREST resolves cleanly.
-- ------------------------------------------------------------------
drop function if exists public.add_staff(text, text, text, text);
drop function if exists public.update_staff(uuid, text, boolean);
drop function if exists public.remove_staff(uuid);
drop function if exists public.advance_kitchen(uuid, text);

-- ------------------------------------------------------------------
-- 3. add_staff(email, full_name, password, role)
-- Creates a real login for brand-new people, or reuses an existing
-- account; both ways end with a staff row in the caller's restaurant.
-- ------------------------------------------------------------------
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

  if add_staff.role not in ('owner', 'manager', 'cashier', 'kitchen') then
    raise exception 'Invalid role';
  end if;

  if length(add_staff.password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  select u.id into v_user_id
  from public.users u
  where lower(u.email) = lower(add_staff.email);

  if v_user_id is null then
    -- Create the auth user; the on_auth_user_created trigger sees
    -- staff_only=true and skips tenant provisioning.
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

-- ------------------------------------------------------------------
-- 4. update_staff(staff_id, role?, is_active?)
-- ------------------------------------------------------------------
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
     and update_staff.role not in ('owner', 'manager', 'cashier', 'kitchen') then
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

-- ------------------------------------------------------------------
-- 5. remove_staff(staff_id)
-- ------------------------------------------------------------------
create or replace function public.remove_staff(
  staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_role text;
begin
  select s.restaurant_id, s.role into v_restaurant_id, v_role
  from public.staff s
  where s.id = remove_staff.staff_id
    and s.restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Staff not found or access denied';
  end if;

  if v_role = 'owner' then
    raise exception 'Cannot remove owner';
  end if;

  if (
    select s.user_id from public.staff s
    where s.id = remove_staff.staff_id
  ) = auth.uid() then
    raise exception 'Cannot remove yourself';
  end if;

  delete from public.staff
  where id = remove_staff.staff_id;
end;
$$;

-- ------------------------------------------------------------------
-- 6. advance_kitchen(order_id, action)
-- ------------------------------------------------------------------
create or replace function public.advance_kitchen(
  order_id uuid,
  action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_new_status text;
  v_item_status text;
begin
  if advance_kitchen.action not in ('preparing', 'ready', 'served') then
    raise exception 'Invalid action: %', advance_kitchen.action;
  end if;

  select * into v_order
  from public.orders
  where id = advance_kitchen.order_id
    and restaurant_id in (select public.user_restaurant_ids());

  if not found then
    raise exception 'Order not found or access denied';
  end if;

  case advance_kitchen.action
    when 'preparing' then
      v_new_status := 'preparing';
      v_item_status := 'preparing';
    when 'ready' then
      v_new_status := 'ready';
      v_item_status := 'ready';
    when 'served' then
      v_new_status := 'served';
      v_item_status := 'ready';
  end case;

  update public.orders
  set status = v_new_status,
      updated_at = now()
  where id = advance_kitchen.order_id;

  if advance_kitchen.action in ('preparing', 'ready') then
    update public.order_items
    set status = v_item_status
    where order_items.order_id = advance_kitchen.order_id
      and order_items.status = 'new';

    if advance_kitchen.action = 'ready' then
      update public.order_items
      set status = 'ready'
      where order_items.order_id = advance_kitchen.order_id
        and order_items.status = 'preparing';
    end if;
  end if;

  if advance_kitchen.action = 'served' then
    update public.order_items
    set status = 'ready'
    where order_items.order_id = advance_kitchen.order_id;
  end if;
end;
$$;
