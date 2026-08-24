-- Migration 018: order-ready notifications go to waiters and cashiers only.
-- Owners, managers and kitchen staff should not receive the "order ready"
-- messages (the kitchen triggered them; owners/managers view orders directly).

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

  -- Only kitchen staff may update order progress.
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

  -- Notify waiters and cashiers when an order is ready to serve or pick up.
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
      and s.role in ('waiter', 'cashier')
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
