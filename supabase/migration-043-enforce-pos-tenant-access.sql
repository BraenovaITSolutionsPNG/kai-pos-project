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
