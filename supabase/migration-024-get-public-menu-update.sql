-- Migration: Update get_public_menu to include restaurant phone and address for online ordering
-- Also add online ordering plan feature check

create or replace function public.get_public_menu(p_restaurant uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant record;
  v_plan text;
  v_result jsonb;
begin
  select r.id, r.name, r.phone, r.address, b.plan into v_restaurant
  from public.restaurants r
  join public.businesses b on b.id = r.business_id
  where r.id = p_restaurant;

  if not found then
    return jsonb_build_object('error', 'Restaurant not found');
  end if;

  -- Check for digital_menu or online_ordering feature
  if not public.plan_has_feature(v_plan, 'digital_menu') and not public.plan_has_feature(v_plan, 'online_ordering') then
    return jsonb_build_object('error', 'Online ordering is not available on this plan');
  end if;

  select jsonb_build_object(
    'restaurant', jsonb_build_object('id', v_restaurant.id, 'name', v_restaurant.name, 'phone', v_restaurant.phone, 'address', v_restaurant.address),
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
    ),
    'promotions', (
      select jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'title', pr.title,
        'subtitle', pr.subtitle,
        'image_url', pr.image_url,
        'sort_order', pr.sort_order
      ) order by pr.sort_order)
      from public.promotions pr
      where pr.restaurant_id = p_restaurant
        and pr.is_active = true
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_public_menu(uuid) to anon, authenticated;