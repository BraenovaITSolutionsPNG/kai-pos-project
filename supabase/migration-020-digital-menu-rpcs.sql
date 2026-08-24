-- Migration 020: Public RPCs for digital self-service menu
-- get_public_menu(p_restaurant uuid) -> jsonb with categories, products, tables
-- create_customer_order(p_restaurant uuid, p_table uuid, p_items jsonb) -> jsonb {order_id, order_number}
-- settle_self_service_table(p_table uuid, p_method text) -> numeric total

create or replace function public.get_public_menu(p_restaurant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_result jsonb;
begin
  -- Verify restaurant exists
  select id, name into v_restaurant
  from public.restaurants
  where id = p_restaurant;

  if not found then
    return jsonb_build_object('error', 'Restaurant not found');
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

-- Create customer order from self-service menu (no payment, occupies table)
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
  v_tax numeric(10,2);
  v_total numeric(10,2);
  v_order_number bigint;
  v_product record;
  v_product_price numeric(10,2);
  v_product_name text;
  v_inserted_items jsonb := '[]'::jsonb;
begin
  -- Verify restaurant exists and get tax rate
  select tax_rate into v_tax_rate
  from public.restaurants
  where id = p_restaurant;

  if not found then
    return jsonb_build_object('error', 'Restaurant not found');
  end if;

  select coalesce(v_tax_rate, 0) into v_tax_rate;

  -- Validate table belongs to restaurant and is available for dine-in
  if not exists (
    select 1 from public.tables
    where id = p_table and restaurant_id = p_restaurant
  ) then
    return jsonb_build_object('error', 'Table not found for this restaurant');
  end if;

  -- Process each item: look up real price & name from products (prevent tampering)
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

    -- Build clean item for order_items
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

  -- Get next order number
  select public.next_order_number(p_restaurant) into v_order_number;

  -- Insert order (no payment, source=self_service, no created_by)
  insert into public.orders
    (restaurant_id, order_number, status, subtotal, tax, total, created_by, order_type, table_id, source)
  values
    (p_restaurant, v_order_number, 'open', v_subtotal, v_tax, v_total, null, 'dine_in', p_table, 'self_service')
  returning * into v_order;

  -- Insert order items
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

  -- Occupy table for dine-in
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

-- Settle self-service table: record payments for all open self-service orders, mark paid, free table
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
  v_restaurant uuid;
  v_total numeric(10,2) := 0;
  v_order record;
begin
  -- Get restaurant from table
  select restaurant_id into v_restaurant
  from public.tables
  where id = p_table;

  if not found then
    raise exception 'Table not found';
  end if;

  -- Find all open self-service dine-in orders for this table
  for v_order in
    select id, total from public.orders
    where table_id = p_table
      and source = 'self_service'
      and order_type = 'dine_in'
      and status not in ('paid', 'cancelled')
  loop
    -- Record payment
    insert into public.payments (order_id, method, amount)
    values (v_order.id, p_method, v_order.total);

    -- Mark order paid
    update public.orders
    set status = 'paid', updated_at = now()
    where id = v_order.id;

    v_total := v_total + v_order.total;
  end loop;

  -- Free the table
  update public.tables
  set status = 'available'
  where id = p_table
    and restaurant_id = v_restaurant;

  return v_total;
end;
$$;

grant execute on function public.settle_self_service_table(uuid, text) to authenticated;