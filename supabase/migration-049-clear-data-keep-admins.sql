-- Migration 049: Clear all business data, keep admin user logins.
-- TRUNCATes every application table, then removes non-admin users from
-- public.users, auth.identities, and auth.users. Platform-admin accounts
-- (is_platform_admin = true) are preserved.

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
TRUNCATE TABLE public.restaurants CASCADE;
TRUNCATE TABLE public.staff CASCADE;
TRUNCATE TABLE public.businesses CASCADE;
TRUNCATE TABLE public.site_content CASCADE;

-- Remove non-admin user profiles.
DELETE FROM public.users
WHERE is_platform_admin IS NOT TRUE;

-- Remove auth identities and accounts for non-admin users.
DELETE FROM auth.identities
WHERE user_id NOT IN (
  SELECT id FROM public.users WHERE is_platform_admin IS TRUE
);

DELETE FROM auth.users
WHERE id NOT IN (
  SELECT id FROM public.users WHERE is_platform_admin IS TRUE
);
