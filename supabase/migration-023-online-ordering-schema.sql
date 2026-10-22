-- Migration: Add online ordering columns to orders table
-- Adds customer info and estimated ready time for takeaway/online orders

-- Add columns for online/takeaway orders
alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_notes text,
  add column if not exists estimated_ready_at timestamptz;

-- Add index for online order lookups
create index if not exists idx_orders_customer_phone on public.orders (customer_phone) where source = 'online';
create index if not exists idx_orders_estimated_ready on public.orders (estimated_ready_at) where order_type = 'takeaway';

comment on column public.orders.customer_name is 'Customer name for online/takeaway orders';
comment on column public.orders.customer_phone is 'Customer phone for online/takeaway orders';
comment on column public.orders.customer_notes is 'Customer notes for online/takeaway orders';
comment on column public.orders.estimated_ready_at is 'Estimated ready time for takeaway orders';