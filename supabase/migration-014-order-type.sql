-- Migration 014: order type (dine_in / takeaway)
-- Lets each POS order be flagged dine-in or takeaway, stored on the
-- order and accepted by create_order.

alter table public.orders
  add column if not exists order_type text not null default 'dine_in'
    check (order_type in ('dine_in', 'takeaway'));

-- Drop the older 4-argument overload so callers don't hit a function
-- ambiguity (PGRST203) when the new defaulted argument is omitted.
drop function if exists public.create_order(uuid, uuid, jsonb, text);

create or replace function public.create_order(
  v_restaurant_id uuid,
  v_created_by uuid,
  p_items jsonb,
  v_method text,
  v_order_type text default 'dine_in'
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
    (restaurant_id, order_number, status, subtotal, tax, total, created_by, order_type)
  values
    (v_restaurant_id, public.next_order_number(v_restaurant_id),
     'open', v_subtotal, v_tax, v_total, v_created_by,
     coalesce(v_order_type, 'dine_in'))
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

  return v_order;
end;
$$;
