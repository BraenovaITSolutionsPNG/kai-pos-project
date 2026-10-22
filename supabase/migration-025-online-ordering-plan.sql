-- Migration: Add online_ordering feature to plan_has_feature
-- Online ordering available on Business and Professional plans

create or replace function public.plan_has_feature(p_plan text, p_feature text)
returns boolean
language plpgsql
immutable
as $$
begin
  return case p_feature
    when 'digital_menu' then p_plan in ('business','professional')
    when 'online_ordering' then p_plan in ('business','professional')
    else false
  end;
end;
$$;