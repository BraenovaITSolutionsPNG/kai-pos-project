-- KAI POS production rollout: migrations 041, 042, and 043
-- Run this entire file once against the intended production database, after
-- applying it successfully to staging and taking a restorable production backup.
-- All migration DDL is in one transaction; any raised error aborts the rollout.
-- This script does not alter platform-admin flags.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

DO $preflight$
DECLARE
  v_missing text;
BEGIN
  IF to_regclass('public.site_content') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.site_content is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'site_content'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(key)%'
  ) THEN
    RAISE EXCEPTION 'Preflight failed: public.site_content.key needs a unique constraint/index';
  END IF;
  IF to_regclass('public.reservations') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.reservations is missing; apply/verify migration 030 first';
  END IF;
  IF to_regprocedure('public.assert_platform_admin()') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.assert_platform_admin() is missing';
  END IF;
  IF to_regprocedure('public.user_restaurant_ids()') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.user_restaurant_ids() is missing';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: auth.uid() is missing';
  END IF;
  IF to_regprocedure('public.next_order_number(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.next_order_number(uuid) is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'Preflight failed: expected Supabase anon/authenticated roles are missing';
  END IF;

  SELECT string_agg(format('%I.%I', req.table_name, req.column_name), ', ')
    INTO v_missing
  FROM (VALUES
    ('site_content','id'), ('site_content','key'), ('site_content','value'),
    ('users','id'), ('users','email'), ('users','full_name'), ('users','is_platform_admin'), ('users','created_at'),
    ('staff','user_id'), ('staff','restaurant_id'), ('staff','is_active'), ('staff','role'),
    ('restaurants','id'), ('restaurants','tax_rate'),
    ('reservations','restaurant_id'),
    ('orders','restaurant_id'), ('orders','order_number'), ('orders','status'), ('orders','subtotal'),
    ('orders','tax'), ('orders','total'), ('orders','created_by'), ('orders','order_type'),
    ('orders','table_id'), ('orders','source'), ('orders','updated_at'),
    ('order_items','order_id'), ('order_items','product_id'), ('order_items','product_name'),
    ('order_items','quantity'), ('order_items','unit_price'), ('order_items','notes'),
    ('products','id'), ('products','restaurant_id'), ('products','name'), ('products','price'), ('products','is_active'),
    ('tables','id'), ('tables','restaurant_id'), ('tables','status'),
    ('payments','order_id'), ('payments','method'), ('payments','amount')
  ) AS req(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = req.table_name
      AND c.column_name = req.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Preflight failed: missing required columns: %', v_missing;
  END IF;
END;
$preflight$;

-- Review this result before applying. It should contain only the administrators
-- you expect to retain; this rollout never changes these flags.
SELECT email, created_at
FROM public.users
WHERE is_platform_admin = true
ORDER BY created_at;


-- ======================================================================
-- 041 — keyed site content
-- ======================================================================

-- Keep landing-page content keyed by its stable text identifier.
-- The prior RPC returned UUID row IDs, while the editor addressed sections by key.
drop function if exists public.get_site_content();

create function public.get_site_content()
returns table (
  id uuid,
  key text,
  value jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select sc.id, sc.key, sc.value
  from public.site_content sc
  order by sc.key;
end;
$$;

grant execute on function public.get_site_content() to anon, authenticated;

create or replace function public.update_site_content(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_key text;
begin
  perform public.assert_platform_admin();

  if jsonb_typeof(items) <> 'array' then
    raise exception 'items must be a JSON array';
  end if;

  for v_item in select * from jsonb_array_elements(update_site_content.items)
  loop
    v_key := nullif(v_item ->> 'key', '');
    if v_key is null then
      raise exception 'site content key is required';
    end if;

    insert into public.site_content (key, value)
    values (v_key, v_item -> 'value')
    on conflict (key) do update
      set value = excluded.value;
  end loop;
end;
$$;

revoke all on function public.update_site_content(jsonb) from public, anon;
grant execute on function public.update_site_content(jsonb) to authenticated;

-- ======================================================================
-- 042 — admin and reservation access
-- ======================================================================

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

-- ======================================================================
-- 043 — POS and settlement tenant access
-- ======================================================================

-- Enforce tenant authorization inside the SECURITY DEFINER POS and settlement RPCs.
-- Apply after migration 020 (digital menu RPCs) and the core schema migrations.

create or replace function public.create_order(
  v_restaurant_id uuid,
  v_created_by uuid,
  p_items jsonb,
  v_method text,
  v_order_type text default 'dine_in',
  v_table_id uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_actor uuid := auth.uid();
  v_item jsonb;
  v_clean_items jsonb := '[]'::jsonb;
  v_product record;
  v_quantity integer;
  v_note text;
  v_subtotal numeric(10, 2) := 0;
  v_tax_rate numeric(10, 2);
  v_tax numeric(10, 2);
  v_total numeric(10, 2);
  v_eff_type text := coalesce(v_order_type, 'dine_in');
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_created_by is distinct from v_actor then
    raise exception 'Order creator must match the signed-in user' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.staff s
    where s.user_id = v_actor
      and s.restaurant_id = v_restaurant_id
      and s.is_active = true
      and s.role in ('owner', 'manager', 'cashier', 'waiter')
  ) then
    raise exception 'You do not have POS access to this restaurant' using errcode = '42501';
  end if;

  select r.tax_rate into v_tax_rate
  from public.restaurants r
  where r.id = v_restaurant_id;

  if not found then
    raise exception 'Restaurant not found' using errcode = '23503';
  end if;

  if v_eff_type not in ('dine_in', 'takeaway') then
    raise exception 'Unsupported order type' using errcode = '22023';
  end if;

  if v_eff_type = 'dine_in' and v_table_id is null then
    raise exception 'A table is required for dine-in orders' using errcode = '22023';
  end if;

  if v_eff_type = 'takeaway' and v_table_id is not null then
    raise exception 'Takeaway orders cannot reference a table' using errcode = '22023';
  end if;

  if v_table_id is not null then
    perform 1
    from public.tables t
    where t.id = v_table_id
      and t.restaurant_id = v_restaurant_id
    for update;

    if not found then
      raise exception 'Table not found for this restaurant' using errcode = '23503';
    end if;
  end if;

  if v_method is null or v_method not in (
    'cash', 'eftpos', 'bank_transfer', 'bsp', 'kina_bank', 'anz', 'westpac', 'other'
  ) then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one order item is required' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as item(value)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or nullif(v_item ->> 'product_id', '') is null
      or nullif(v_item ->> 'quantity', '') is null then
      raise exception 'Invalid order item' using errcode = '22023';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity <= 0 then
      raise exception 'Order quantities must be positive integers' using errcode = '22023';
    end if;

    v_note := v_item ->> 'notes';
    if length(v_note) > 500 then
      raise exception 'Order item notes are too long' using errcode = '22023';
    end if;

    select p.id, p.name, p.price into v_product
    from public.products p
    where p.id = (v_item ->> 'product_id')::uuid
      and p.restaurant_id = v_restaurant_id
      and p.is_active = true
    for share;

    if not found then
      raise exception 'Product is invalid, inactive, or belongs to another restaurant' using errcode = '23503';
    end if;

    v_subtotal := v_subtotal + (v_quantity * v_product.price);
    v_clean_items := v_clean_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'quantity', v_quantity,
      'unit_price', v_product.price,
      'notes', v_note
    ));
  end loop;

  v_tax_rate := coalesce(v_tax_rate, 0);
  v_tax := round(v_subtotal * v_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax;

  insert into public.orders
    (restaurant_id, order_number, status, subtotal, tax, total, created_by, order_type, table_id)
  values
    (v_restaurant_id, public.next_order_number(v_restaurant_id), 'open',
     v_subtotal, v_tax, v_total, v_actor, v_eff_type, v_table_id)
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(v_clean_items) as item(value)
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

  insert into public.payments (order_id, method, amount)
  values (v_order.id, v_method, v_total);

  if v_eff_type = 'dine_in' then
    update public.tables
    set status = 'occupied'
    where id = v_table_id
      and restaurant_id = v_restaurant_id;
  end if;

  return v_order;
end;
$$;

revoke all on function public.create_order(uuid, uuid, jsonb, text, text, uuid) from PUBLIC, anon;
grant execute on function public.create_order(uuid, uuid, jsonb, text, text, uuid) to authenticated;

create or replace function public.settle_self_service_table(
  p_table uuid,
  p_method text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_restaurant uuid;
  v_total numeric(10, 2) := 0;
  v_order record;
  v_settled_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_method is null or p_method not in (
    'cash', 'eftpos', 'bank_transfer', 'bsp', 'kina_bank', 'anz', 'westpac', 'other'
  ) then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;

  select t.restaurant_id into v_restaurant
  from public.tables t
  where t.id = p_table
  for update;

  if not found then
    raise exception 'Table not found' using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.staff s
    where s.user_id = v_actor
      and s.restaurant_id = v_restaurant
      and s.is_active = true
      and s.role in ('owner', 'manager', 'cashier')
  ) then
    raise exception 'You do not have bills access to this restaurant' using errcode = '42501';
  end if;

  for v_order in
    select o.id, o.total
    from public.orders o
    where o.restaurant_id = v_restaurant
      and o.table_id = p_table
      and o.source = 'self_service'
      and o.order_type = 'dine_in'
      and o.status not in ('paid', 'cancelled')
    for update
  loop
    insert into public.payments (order_id, method, amount)
    values (v_order.id, p_method, v_order.total);

    update public.orders
    set status = 'paid', updated_at = now()
    where id = v_order.id
      and restaurant_id = v_restaurant;

    v_total := v_total + v_order.total;
    v_settled_count := v_settled_count + 1;
  end loop;

  if v_settled_count = 0 then
    raise exception 'No open self-service orders found for this table' using errcode = 'P0002';
  end if;

  update public.tables
  set status = 'available'
  where id = p_table
    and restaurant_id = v_restaurant;

  return v_total;
end;
$$;

revoke all on function public.settle_self_service_table(uuid, text) from PUBLIC, anon;
grant execute on function public.settle_self_service_table(uuid, text) to authenticated;

DO $postflight$
DECLARE
  v_bad_policies integer;
BEGIN
  IF NOT has_function_privilege('anon', 'public.get_site_content()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_site_content()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight failed: public site-content reads are not granted';
  END IF;
  IF has_function_privilege('anon', 'public.update_site_content(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight failed: anonymous site-content writes are executable';
  END IF;
  IF has_function_privilege('anon', 'public.get_admin_users()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_admin_users()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight failed: admin user RPC grants are incorrect';
  END IF;
  IF position('assert_platform_admin' in pg_get_functiondef('public.get_admin_users()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Postflight failed: get_admin_users() is missing its platform-admin guard';
  END IF;
  IF has_function_privilege('anon', 'public.create_order(uuid,uuid,jsonb,text,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.create_order(uuid,uuid,jsonb,text,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight failed: create_order() grants are incorrect';
  END IF;
  IF has_function_privilege('anon', 'public.settle_self_service_table(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.settle_self_service_table(uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Postflight failed: settlement RPC grants are incorrect';
  END IF;
  IF NOT (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.reservations'::regclass) THEN
    RAISE EXCEPTION 'Postflight failed: reservations RLS is disabled';
  END IF;

  SELECT count(*) INTO v_bad_policies
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = 'reservations'
    AND p.policyname IN ('reservations_select','reservations_insert','reservations_update','reservations_delete')
    AND (coalesce(p.qual, '') || coalesce(p.with_check, '')) NOT ILIKE '%user_restaurant_ids%';
  IF v_bad_policies > 0 OR (
    SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'reservations'
      AND p.policyname IN ('reservations_select','reservations_insert','reservations_update','reservations_delete')
  ) <> 4 THEN
    RAISE EXCEPTION 'Postflight failed: reservation policies are missing or not tenant-scoped';
  END IF;
END;
$postflight$;

COMMIT;

-- Final read-only confirmation. Review the admin list and the four policy rows.
SELECT email, created_at
FROM public.users
WHERE is_platform_admin = true
ORDER BY created_at;

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'reservations'
ORDER BY policyname;

SELECT 'get_site_content_anon' AS check_name,
       has_function_privilege('anon', 'public.get_site_content()', 'EXECUTE') AS passed
UNION ALL SELECT 'update_site_content_anon_denied',
       NOT has_function_privilege('anon', 'public.update_site_content(jsonb)', 'EXECUTE')
UNION ALL SELECT 'get_admin_users_anon_denied',
       NOT has_function_privilege('anon', 'public.get_admin_users()', 'EXECUTE')
UNION ALL SELECT 'create_order_anon_denied',
       NOT has_function_privilege('anon', 'public.create_order(uuid,uuid,jsonb,text,text,uuid)', 'EXECUTE')
UNION ALL SELECT 'settlement_anon_denied',
       NOT has_function_privilege('anon', 'public.settle_self_service_table(uuid,text)', 'EXECUTE');
