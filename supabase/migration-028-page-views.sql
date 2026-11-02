-- Page views tracking for platform analytics
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  visitor_id text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx on public.page_views (path);

alter table public.page_views enable row level security;

-- Anyone can insert page views (anonymous tracking)
drop policy if exists "page_views insert" on public.page_views;
create policy "page_views insert" on public.page_views
  for insert to anon, authenticated
  with check (true);

-- Only platform admins can read
drop policy if exists "page_views admin read" on public.page_views;
create policy "page_views admin read" on public.page_views
  for select to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and is_platform_admin = true));

