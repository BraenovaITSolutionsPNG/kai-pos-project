-- Migration 006: inventory RPC argument names.
-- The inventory UI calls restock_ingredient/adjust_ingredient with
-- (ingredient_id, quantity[, note]) but the DB used p_-prefixed params ->
-- PostgREST "not found in the schema cache". Recreated with the client's
-- exact argument names; logic unchanged.

drop function if exists public.restock_ingredient(uuid, numeric);
create or replace function public.restock_ingredient(
  ingredient_id uuid,
  quantity numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  -- Verify ingredient belongs to user's restaurant
  select restaurant_id into v_restaurant_id
  from public.ingredients
  where id = restock_ingredient.ingredient_id
    and restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Ingredient not found or access denied';
  end if;

  if restock_ingredient.quantity <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  update public.ingredients
  set current_stock = current_stock + restock_ingredient.quantity
  where id = restock_ingredient.ingredient_id;

  insert into public.inventory_transactions
    (restaurant_id, ingredient_id, type, quantity, created_by)
  values
    (v_restaurant_id, restock_ingredient.ingredient_id, 'restock',
     restock_ingredient.quantity, auth.uid());
end;
$$;

drop function if exists public.adjust_ingredient(uuid, numeric, text);
create or replace function public.adjust_ingredient(
  ingredient_id uuid,
  quantity numeric,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_old_stock numeric;
  v_diff numeric;
begin
  -- Verify ingredient belongs to user's restaurant
  select restaurant_id, current_stock into v_restaurant_id, v_old_stock
  from public.ingredients
  where id = adjust_ingredient.ingredient_id
    and restaurant_id in (select public.user_restaurant_ids());

  if v_restaurant_id is null then
    raise exception 'Ingredient not found or access denied';
  end if;

  if adjust_ingredient.quantity < 0 then
    raise exception 'Quantity cannot be negative';
  end if;

  v_diff := adjust_ingredient.quantity - v_old_stock;

  update public.ingredients
  set current_stock = adjust_ingredient.quantity
  where id = adjust_ingredient.ingredient_id;

  insert into public.inventory_transactions
    (restaurant_id, ingredient_id, type, quantity, reference, created_by)
  values
    (v_restaurant_id, adjust_ingredient.ingredient_id, 'adjustment',
     v_diff, adjust_ingredient.note, auth.uid());
end;
$$;
