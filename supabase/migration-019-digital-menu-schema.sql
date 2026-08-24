-- Migration 019: Add digital menu columns and orders.source
-- products: ingredients (text), prep_time (minutes, integer)
-- orders: source ('pos' | 'self_service') default 'pos'

alter table public.products
  add column if not exists ingredients text;

alter table public.products
  add column if not exists prep_time integer not null default 0;

alter table public.orders
  add column if not exists source text not null default 'pos'
  check (source in ('pos', 'self_service'));

comment on column public.products.ingredients is 'Comma-separated or descriptive list of ingredients for the dish';
comment on column public.products.prep_time is 'Estimated preparation/cook time in minutes';
comment on column public.orders.source is 'Order origin: pos (staff) or self_service (customer QR)';