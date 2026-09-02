-- Migration 024: Contact form messages
-- Users can submit messages via the Contact page; admins can read and delete.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','read','archived')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_restaurant_id_idx
  on public.messages (restaurant_id);

create index if not exists messages_status_idx
  on public.messages (status);

alter table public.messages enable row level security;

create policy "messages select for owner/manager" on public.messages for select
  using ((restaurant_id in (select public.user_restaurant_ids())) or restaurant_id is null);

create policy "messages insert for everyone" on public.messages for insert
  with check (true);

create policy "messages update for owner/manager" on public.messages for update
  using ((restaurant_id in (select public.user_restaurant_ids())) or restaurant_id is null);

create policy "messages delete for owner/manager" on public.messages for delete
  using ((restaurant_id in (select public.user_restaurant_ids())) or restaurant_id is null);

comment on table public.messages is 'Contact form messages from users; admins can read and change status (read/archived) or delete. NULL restaurant_id means public submission.';