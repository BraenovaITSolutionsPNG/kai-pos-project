-- RPC to handle new user setup (replicates handle_new_user trigger)
-- Used when the auth trigger is disabled
create or replace function public.setup_new_user(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_business_name text,
  p_plan text
)
returns void
language plpgsql
security definer
set search_path = public
as 
declare
  v_business_id uuid;
  v_restaurant_id uuid;
  v_food uuid;
  v_drinks uuid;
  v_snacks uuid;
  v_desserts uuid;
  v_plan text := coalesce(nullif(p_plan, ''), 'starter');
begin
  if v_plan not in ('starter', 'business', 'professional') then
    v_plan := 'starter';
  end if;

  insert into public.users (id, email, full_name)
  values (p_user_id, p_email, coalesce(nullif(p_full_name, ''), p_email))
  on conflict (id) do nothing;

  insert into public.businesses (name, owner_id, plan, is_active)
  values (coalesce(nullif(p_business_name, ''), p_full_name || ' Cafe'), p_user_id, v_plan, false)
  returning id into v_business_id;

  insert into public.restaurants (business_id, name, address, currency)
  values (v_business_id, coalesce(nullif(p_business_name, ''), p_full_name || ' Cafe') || ' - Main', '', 'PGK')
  returning id into v_restaurant_id;

  insert into public.staff (restaurant_id, user_id, role, is_active)
  values (v_restaurant_id, p_user_id, 'owner', true);

  insert into public.categories (restaurant_id, name, sort_order) values
    (v_restaurant_id, 'Food', 1),
    (v_restaurant_id, 'Drinks', 2),
    (v_restaurant_id, 'Snacks', 3),
    (v_restaurant_id, 'Desserts', 4);

  select id into v_food from public.categories
    where restaurant_id = v_restaurant_id and name = 'Food';
  select id into v_drinks from public.categories
    where restaurant_id = v_restaurant_id and name = 'Drinks';
  select id into v_snacks from public.categories
    where restaurant_id = v_restaurant_id and name = 'Snacks';
  select id into v_desserts from public.categories
    where restaurant_id = v_restaurant_id and name = 'Desserts';

  insert into public.products
    (restaurant_id, category_id, name, price, sort_order) values
    (v_restaurant_id, v_food,    'Chicken Fried Rice',        25.00, 1),
    (v_restaurant_id, v_food,    'Fish & Chips',              32.00, 2),
    (v_restaurant_id, v_food,    'Chicken Steak',             38.00, 3),
    (v_restaurant_id, v_food,    'BBQ Pork Ribs',             42.00, 4),
    (v_restaurant_id, v_drinks,  'Coca-Cola (330ml)',          5.50, 1),
    (v_restaurant_id, v_drinks,  'Fresh Water (1.5L)',         5.00, 2),
    (v_restaurant_id, v_drinks,  'Mango Juice',                8.00, 3),
    (v_restaurant_id, v_snacks,  'Crisps',                     4.00, 1),
    (v_restaurant_id, v_snacks,  'Chicken Roll',              12.00, 2),
    (v_restaurant_id, v_desserts,'Ice Cream Sundae',           8.00, 1);
end;
;
