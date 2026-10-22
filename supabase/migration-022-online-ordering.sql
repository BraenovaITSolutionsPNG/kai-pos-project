-- Migration: Online ordering (takeaway) for public customers
-- Creates a public RPC for takeaway orders without table requirement

-- create_takeaway_order(p_restaurant uuid, p_items jsonb, p_customer jsonb)
-- p_customer: { name: string, phone: string, pickup_time?: string, notes?: string, type: 'pickup' | 'delivery', address?: string }
-- Returns: { order_id, order_number, total, estimated_ready_time }

create or replace function public.create_takeaway_order(
  p_restaurant uuid,
  p_items jsonb,
  p_customer jsonb
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
  v_customer_name text;
  v_customer_phone text;
  v_pickup_time timestamptz;
  v_notes text;
  v_order_type text := 'takeaway';
  v_prep_time int := 15; -- default prep time in minutes
begin
  -- Verify restaurant exists and get tax rate
  select tax_rate into v_tax_rate
  from public.restaurants
  where id = p_restaurant;

  if not found then
    return jsonb_build_object('error', 'Restaurant not found');
  end if;

  select coalesce(v_tax_rate, 0) into v_tax_rate;

  -- Validate and extract customer info
  v_customer_name := p_customer ->> 'name';
  v_customer_phone := p_customer ->> 'phone';
  v_notes := p_customer ->> 'notes';

  if v_customer_name is null or v_customer_name = '' then
    return jsonb_build_object('error', 'Customer name is required');
  end if;
  if v_customer_phone is null or v_customer_phone = '' then
    return jsonb_build_object('error', 'Customer phone is required');
  end if;

  -- Parse optional pickup time
  if p_customer ? 'pickup_time' and (p_customer ->> 'pickup_time') <> '' then
    v_pickup_time := (p_customer ->> 'pickup_time')::timestamptz;
  end if;

  -- Process each item: look up real price & name from products (prevent tampering)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select id, name, price, prep_time into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and restaurant_id = p_restaurant
      and is_active = true;

    if not found then
      return jsonb_build_object('error', 'Invalid or inactive product: ' || (v_item ->> 'product_id'));
    end if;

    v_product_price := v_product.price;
    v_product_name := v_product.name;
    v_prep_time := greatest(v_prep_time, coalesce(v_product.prep_time, 15));

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

  -- Insert order (takeaway, no table, source=online, no created_by)
  insert into public.orders
    (restaurant_id, order_number, status, subtotal, tax, total, created_by, order_type, table_id, source, customer_name, customer_phone, customer_notes, estimated_ready_at)
  values
    (p_restaurant, v_order_number, 'open', v_subtotal, v_tax, v_total, null, v_order_type, null, 'online', v_customer_name, v_customer_phone, v_notes, v_pickup_time)
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

  -- Calculate estimated ready time
  declare
    v_estimated_ready timestamptz := now() + (v_prep_time || ' minutes')::interval;
  begin
    if v_pickup_time is not null and v_pickup_time > v_estimated_ready then
      v_estimated_ready := v_pickup_time;
    end if;

    -- Update order with estimated ready time
    update public.orders
    set estimated_ready_at = v_estimated_ready
    where id = v_order.id;
  end;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'total', v_order.total,
    'estimated_ready_time', to_char(v_estimated_ready, 'HH24:MI'),
    'estimated_ready_at', v_estimated_ready
  );
end;
$$;

grant execute on function public.create_takeaway_order(uuid, jsonb, jsonb) to anon, authenticated;