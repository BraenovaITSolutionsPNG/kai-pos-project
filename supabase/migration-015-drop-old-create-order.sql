-- Migration 015: drop the legacy 4-argument create_order overload.
-- Migration 014 added a 5-argument version (with v_order_type) but, because
-- the original 4-argument function still existed, it became an overload rather
-- than a replacement. Drop the old one so callers without v_order_type resolve
-- unambiguously.

drop function if exists public.create_order(uuid, uuid, jsonb, text);
