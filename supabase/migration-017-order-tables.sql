-- Migration 017: link dine-in orders to tables.
-- create_order now accepts v_table_id; a dine-in order marks its table
-- 'occupied'. When an order is served (advance_kitchen 'served') the table
-- is freed back to 'available'. Ready notifications now include the table
-- label, e.g. "Order #12 is ready to serve (Table 5)".

-- Drop the previous 5-argument overload so the new 6-argument version is
-- the only candidate (avoids PGRST203 ambiguity).
drop function if exists public.create_order(uuid, uuid, jsonb, text, text);

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
  v_item jsonb;
  v_subtotal numeric(10, 2) := 0;
  v_tax_rate numeric(10, 2);
  v_tax numeric(10, 2);
  v_total numeric(10, 2);
  v_eff_type text := coalesce(v_order_type, 'dine_in');
begin
  select tax_rate into v_tax_rate
  from public.restaurants
  where id = v_restaurant_id;

  select coalesce(v_tax_rate, 0) into v_tax_rate;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_subtotal := v_subtotal +
      ((v_item ->> 'quantity')::numeric * (v_item ->> 'unit_price')::numeric);
  end loop;

  v_tax := round(v_subtotal * v_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax;

  insert into public.orders
    (restaurant_id, order_number, status, subtotal, tax, total, created_by, order_type, table_id)
  values
    (v_restaurant_id, public.next_order_number(v_restaurant_id),
     'open', v_subtotal, v_tax, v_total, v_created_by,
     v_eff_type, v_table_id)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
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

  -- A dine-in order occupies its table.
  if v_eff_type = 'dine_in' and v_table_id is not null then
    update public.tables
    set status = 'occupied'
    where id = v_table_id
      and restaurant_id = v_restaurant_id;
  end if;

  return v_order;
end;
$$;

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
  v_role text;
  v_msg text;
  v_table_label text;
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

  select s.role into v_role
  from public.staff s
  where s.user_id = auth.uid()
    and s.restaurant_id = v_order.restaurant_id
    and s.is_active = true
  limit 1;

  if coalesce(v_role, '') <> 'kitchen' then
    raise exception 'Only kitchen staff can update orders';
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

    if v_order.table_id is not null then
      update public.tables
      set status = 'available'
      where id = v_order.table_id
        and restaurant_id = v_order.restaurant_id;
    end if;
  end if;

  if advance_kitchen.action = 'ready' then
    select t.label into v_table_label
    from public.tables t
    where t.id = v_order.table_id;

    v_msg := 'Order #' || v_order.order_number ||
             case when v_order.order_type = 'takeaway'
                  then ' is ready for pickup'
                  else ' is ready to serve' end ||
             case when v_table_label is not null
                  then ' (Table ' || v_table_label || ')'
                  else '' end;

    insert into public.notifications (user_id, message, link)
    select s.user_id, v_msg, '/orders'
    from public.staff s
    where s.restaurant_id = v_order.restaurant_id
      and s.is_active = true
      and s.role <> 'kitchen'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = s.user_id
          and n.link = '/orders'
          and n.message = v_msg
          and n.read_at is null
      );
  end if;
end;
$$;
