-- Migration 022: Fix duplicate order numbers
--
-- The previous next_order_number() reset the counter to 1 each new day, but
-- orders.order_number is unique only on (restaurant_id, order_number) (not per
-- day). On a new day the counter wrapped to 1 and collided with the previous
-- day's order #1, violating orders_restaurant_id_order_number_key. It was also
-- unsafe under concurrent orders.
--
-- New approach: keep an order_counters row per restaurant, but derive the next
-- number from BOTH the stored counter and the actual max(order_number) in
-- orders (so stale/reset counters can never collide with real orders), and
-- serialize allocation with a FOR UPDATE row lock on the counter row. No daily
-- reset.

create or replace function public.next_order_number(v_restaurant_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
begin
  -- Ensure a counter row exists for this restaurant.
  insert into public.order_counters (restaurant_id, day, last_number)
  values (v_restaurant_id, current_date, 0)
  on conflict (restaurant_id) do nothing;

  -- Lock the counter row so concurrent allocations serialize.
  select greatest(
           oc.last_number,
           coalesce(
             (select max(o.order_number)
                from public.orders o
               where o.restaurant_id = v_restaurant_id),
             0
           )
         )
    into v_next
  from public.order_counters oc
  where oc.restaurant_id = v_restaurant_id
  for update;

  v_next := v_next + 1;

  update public.order_counters
     set last_number = v_next,
         day = current_date
   where restaurant_id = v_restaurant_id;

  return v_next;
end;
$$;
