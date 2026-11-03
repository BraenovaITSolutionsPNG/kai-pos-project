-- Migration 047: Clear all data from all tables.
-- WARNING: This permanently deletes ALL data. Run only when you want a clean slate.

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
