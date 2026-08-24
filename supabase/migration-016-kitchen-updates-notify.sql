-- Migration 016: kitchen-only order updates + order-ready notifications.
-- advance_kitchen now rejects anyone who is not an active kitchen staff
-- member, and when an order is marked ready it drops a notification for
-- every other active staff member (waiters, cashiers, managers, owners)
-- so they know an order is ready to serve / pick up.

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
  end if;

  -- Notify non-kitchen staff when an order is ready to serve or pick up.
  if advance_kitchen.action = 'ready' then
    v_msg := case when v_order.order_type = 'takeaway'
                  then 'Order #' || v_order.order_number || ' is ready for pickup'
                  else 'Order #' || v_order.order_number || ' is ready to serve' end;

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
