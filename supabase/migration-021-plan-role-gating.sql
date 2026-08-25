-- Migration 021: Plan-based role & feature gating
--
-- Enforces, at the database level, that:
--   1. A role can only be assigned if the business plan allows it
--      (Starter = owner only; Business = owner/manager/cashier;
--       Professional = all roles).
--   2. The public digital self-service menu is only available on
--      Business / Professional plans (Starter is rejected).

-- Plan -> role / feature helpers (single source of truth, mirrored in lib/plans.ts)
create or replace function public.plan_allows_role(p_plan text, p_role text)
returns boolean
language plpgsql
immutable
as $$
begin
  return p_role = any (case p_plan
    when 'starter'      then array['owner']::text[]
    when 'business'     then array['owner','manager','cashier']::text[]
    when 'professional' then array['owner','manager','cashier','kitchen','waiter']::text[]
    else array['owner']::text[]
  end);
end;
$$;

create or replace function public.plan_has_feature(p_plan text, p_feature text)
returns boolean
language plpgsql
immutable
as $$
begin
  return case p_feature when 'digital_menu' then p_plan in ('business','professional') else false end;
end;
$$;

-- add_staff: reject roles not allowed on the business plan
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
  v_plan text;
begin
  select restaurant_id into v_restaurant_id
  from public.staff
  where user_id = auth.uid() and is_active = true
  limit 1;

  if v_restaurant_id is null then
    raise exception 'No active restaurant found for current user';
  end if;

  select b.plan into v_plan
  from public.restaurants r
  join public.businesses b on b.id = r.business_id
  where r.id = v_restaurant_id;

  if add_staff.role not in ('owner', 'manager', 'cashier', 'kitchen', 'waiter') then
    raise exception 'Invalid role';
  end if;

  if not public.plan_allows_role(v_plan, add_staff.role) then
    raise exception 'Role % is not available on the % plan', add_staff.role, v_plan;
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

-- update_staff: reject role changes not allowed on the business plan
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
  v_plan text;
begin
  select s.restaurant_id into v_restaurant_id
  from public.staff s
  where s.id = update_staff.staff_id
    and s.restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Staff not found or access denied';
  end if;

  select b.plan into v_plan
  from public.restaurants r
  join public.businesses b on b.id = r.business_id
  where r.id = v_restaurant_id;

  if update_staff.role is not null
     and update_staff.role not in ('owner', 'manager', 'cashier', 'kitchen', 'waiter') then
    raise exception 'Invalid role';
  end if;

  if update_staff.role is not null
     and not public.plan_allows_role(v_plan, update_staff.role) then
    raise exception 'Role % is not available on the % plan', update_staff.role, v_plan;
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

-- get_public_menu: reject Starter plans
create or replace function public.get_public_menu(p_restaurant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_plan text;
  v_result jsonb;
begin
  select r.id, r.name, b.plan into v_restaurant
  from public.restaurants r
  join public.businesses b on b.id = r.business_id
  where r.id = p_restaurant;

  if not found then
    return jsonb_build_object('error', 'Restaurant not found');
  end if;

  if not public.plan_has_feature(v_plan, 'digital_menu') then
    return jsonb_build_object('error', 'Digital menu is not available on this plan');
  end if;

  select jsonb_build_object(
    'restaurant', jsonb_build_object('id', v_restaurant.id, 'name', v_restaurant.name),
    'categories', (
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sort_order', c.sort_order) order by c.sort_order)
      from public.categories c
      where c.restaurant_id = p_restaurant
    ),
    'products', (
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'price', p.price,
        'image_url', p.image_url,
        'ingredients', p.ingredients,
        'prep_time', p.prep_time,
        'category_id', p.category_id,
        'is_active', p.is_active,
        'sort_order', p.sort_order
      ) order by p.sort_order)
      from public.products p
      where p.restaurant_id = p_restaurant
        and p.is_active = true
    ),
    'tables', (
      select jsonb_agg(jsonb_build_object('id', t.id, 'label', t.label) order by t.label)
      from public.tables t
      where t.restaurant_id = p_restaurant
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_public_menu(uuid) to anon, authenticated;

-- create_customer_order: reject Starter plans
create or replace function public.create_customer_order(
  p_restaurant uuid,
  p_table uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_item jsonb;
  v_subtotal numeric(10,2) := 0;
  v_tax_rate numeric(10,2);
  v_plan text;
  v_tax numeric(10,2);
  v_total numeric(10,2);
  v_order_number bigint;
  v_product record;
  v_product_price numeric(10,2);
  v_product_name text;
  v_inserted_items jsonb := '[]'::jsonb;
begin
  select tax_rate, b.plan into v_tax_rate, v_plan
  from public.restaurants r
  join public.businesses b on b.id = r.business_id
  where r.id = p_restaurant;

  if not found then
    return jsonb_build_object('error', 'Restaurant not found');
  end if;

  if not public.plan_has_feature(v_plan, 'digital_menu') then
    return jsonb_build_object('error', 'Digital menu is not available on this plan');
  end if;

  select coalesce(v_tax_rate, 0) into v_tax_rate;

  if not exists (
    select 1 from public.tables
    where id = p_table and restaurant_id = p_restaurant
  ) then
    return jsonb_build_object('error', 'Table not found for this restaurant');
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select id, name, price into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and restaurant_id = p_restaurant
      and is_active = true;

    if not found then
      return jsonb_build_object('error', 'Invalid or inactive product: ' || (v_item ->> 'product_id'));
    end if;

    v_product_price := v_product.price;
    v_product_name := v_product.name;

    v_subtotal := v_subtotal + ((v_item ->> 'quantity')::numeric * v_product_price);

    v_inserted_items := v_inserted_items || jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product_name,
      'quantity', (v_item ->> 'quantity')::integer,
      'unit_price', v_product_price,
      'notes', v_item ->> 'notes'
    );
  end loop;

  if jsonb_array_length(v_inserted_items) = 0 then
    return jsonb_build_object('error', 'No valid items provided');
  end if;

  v_tax := round(v_subtotal * v_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax;

  select public.next_order_number(p_restaurant) into v_order_number;

  insert into public.orders
    (restaurant_id, order_number, status, subtotal, tax, total, created_by, order_type, table_id, source)
  values
    (p_restaurant, v_order_number, 'open', v_subtotal, v_tax, v_total, null, 'dine_in', p_table, 'self_service')
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(v_inserted_items)
  loop
    insert into public.order_items
      (order_id, product_id, product_name, quantity, unit_price, notes)
    values
      (v_order.id,
       (v_item ->> 'product_id')::uuid,
       v_item ->> 'product_name',
       (v_item ->> 'quantity')::integer,
       (v_item ->> 'unit_price')::numeric,
       v_item ->> 'notes');
  end loop;

  update public.tables
  set status = 'occupied'
  where id = p_table
    and restaurant_id = p_restaurant
    and status != 'occupied';

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'total', v_order.total
  );
end;
$$;

grant execute on function public.create_customer_order(uuid, uuid, jsonb) to anon, authenticated;
