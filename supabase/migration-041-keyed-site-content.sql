-- Keep landing-page content keyed by its stable text identifier.
-- The prior RPC returned UUID row IDs, while the editor addressed sections by key.
drop function if exists public.get_site_content();

create function public.get_site_content()
returns table (
  id uuid,
  key text,
  value jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select sc.id, sc.key, sc.value
  from public.site_content sc
  order by sc.key;
end;
$$;

grant execute on function public.get_site_content() to anon, authenticated;

create or replace function public.update_site_content(items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_key text;
begin
  perform public.assert_platform_admin();

  if jsonb_typeof(items) <> 'array' then
    raise exception 'items must be a JSON array';
  end if;

  for v_item in select * from jsonb_array_elements(update_site_content.items)
  loop
    v_key := nullif(v_item ->> 'key', '');
    if v_key is null then
      raise exception 'site content key is required';
    end if;

    insert into public.site_content (key, value)
    values (v_key, v_item -> 'value')
    on conflict (key) do update
      set value = excluded.value;
  end loop;
end;
$$;

revoke all on function public.update_site_content(jsonb) from public, anon;
grant execute on function public.update_site_content(jsonb) to authenticated;
