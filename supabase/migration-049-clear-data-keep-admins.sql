-- Migration 049: Clear all business/test data, keep admin logins,
-- and create the RPC function for future one-click in-app resets.
--
-- Can be executed directly in the Supabase Dashboard SQL Editor.

-- 1. Wipe all business, restaurant, order, and transaction data
TRUNCATE TABLE public.order_items CASCADE;
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.orders CASCADE;
TRUNCATE TABLE public.cashups CASCADE;
TRUNCATE TABLE public.expenses CASCADE;
TRUNCATE TABLE public.inventory_transactions CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.order_counters CASCADE;
TRUNCATE TABLE public.subscription_payments CASCADE;
TRUNCATE TABLE public.customers CASCADE;
TRUNCATE TABLE public.shifts CASCADE;
TRUNCATE TABLE public.shift_schedules CASCADE;
TRUNCATE TABLE public.recipes CASCADE;
TRUNCATE TABLE public.ingredients CASCADE;
TRUNCATE TABLE public.products CASCADE;
TRUNCATE TABLE public.categories CASCADE;
TRUNCATE TABLE public.tables CASCADE;
TRUNCATE TABLE public.reservations CASCADE;
TRUNCATE TABLE public.restaurants CASCADE;
TRUNCATE TABLE public.staff CASCADE;
TRUNCATE TABLE public.businesses CASCADE;
TRUNCATE TABLE public.site_content CASCADE;

-- 2. Remove non-admin user profiles (preserves is_platform_admin = true)
DELETE FROM public.users
WHERE is_platform_admin IS NOT TRUE;

-- 3. Remove auth identities and auth.users logins for non-admin users
DELETE FROM auth.identities
WHERE user_id NOT IN (
  SELECT id FROM public.users WHERE is_platform_admin IS TRUE
);

DELETE FROM auth.users
WHERE id NOT IN (
  SELECT id FROM public.users WHERE is_platform_admin IS TRUE
);

-- 4. Create RPC function so the web app's "Reset test data" button can run
-- using only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
CREATE OR REPLACE FUNCTION public.clear_platform_test_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security: verify the caller is a platform administrator
  PERFORM public.assert_platform_admin();

  TRUNCATE TABLE public.order_items CASCADE;
  TRUNCATE TABLE public.payments CASCADE;
  TRUNCATE TABLE public.orders CASCADE;
  TRUNCATE TABLE public.cashups CASCADE;
  TRUNCATE TABLE public.expenses CASCADE;
  TRUNCATE TABLE public.inventory_transactions CASCADE;
  TRUNCATE TABLE public.notifications CASCADE;
  TRUNCATE TABLE public.order_counters CASCADE;
  TRUNCATE TABLE public.subscription_payments CASCADE;
  TRUNCATE TABLE public.customers CASCADE;
  TRUNCATE TABLE public.shifts CASCADE;
  TRUNCATE TABLE public.shift_schedules CASCADE;
  TRUNCATE TABLE public.recipes CASCADE;
  TRUNCATE TABLE public.ingredients CASCADE;
  TRUNCATE TABLE public.products CASCADE;
  TRUNCATE TABLE public.categories CASCADE;
  TRUNCATE TABLE public.tables CASCADE;
  TRUNCATE TABLE public.reservations CASCADE;
  TRUNCATE TABLE public.restaurants CASCADE;
  TRUNCATE TABLE public.staff CASCADE;
  TRUNCATE TABLE public.businesses CASCADE;

  DELETE FROM public.users
  WHERE is_platform_admin IS NOT TRUE;

  DELETE FROM auth.identities
  WHERE user_id NOT IN (
    SELECT id FROM public.users WHERE is_platform_admin IS TRUE
  );

  DELETE FROM auth.users
  WHERE id NOT IN (
    SELECT id FROM public.users WHERE is_platform_admin IS TRUE
  );

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'All platform test data cleared successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_platform_test_data() TO authenticated;
