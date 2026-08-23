-- Migration 003: notifications + site content RPCs.
-- Restores get_notifications/get_site_content as typed functions
-- (PostgREST cannot call untyped `setof record`) and adds the two
-- RPCs the UI calls that never existed in the database.

drop function if exists public.get_notifications();
drop function if exists public.get_site_content();

create or replace function public.get_notifications()
returns table (
  id uuid,
  message text,
  link text,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    n.id,
    n.message,
    n.link,
    n.read_at,
    n.created_at
  from public.notifications n
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit 50;
end;
$$;

create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where user_id = auth.uid() and read_at is null;
$$;

create or replace function public.get_site_content()
returns table (
  id uuid,
  value jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    sc.id,
    sc.value
  from public.site_content sc
  order by sc.key;
end;
$$;

create or replace function public.update_site_content(
  items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  perform public.assert_platform_admin();

  for v_item in select * from jsonb_array_elements(update_site_content.items)
  loop
    update public.site_content
    set value = v_item -> 'value'
    where id = (v_item ->> 'id')::uuid;
  end loop;
end;
$$;
