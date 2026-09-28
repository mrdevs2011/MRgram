-- MRgram Stories (24 soatlik)
create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  media_path  text not null,
  media_type  text not null default 'image',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);
create index if not exists stories_expires_idx on public.stories (expires_at desc);
create index if not exists stories_user_idx on public.stories (user_id, created_at desc);

create table if not exists public.story_views (
  story_id   uuid not null references public.stories(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (story_id, user_id)
);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories for select to authenticated
  using (expires_at > now());

drop policy if exists stories_insert on public.stories;
create policy stories_insert on public.stories for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists stories_delete on public.stories;
create policy stories_delete on public.stories for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists story_views_select on public.story_views;
create policy story_views_select on public.story_views for select to authenticated
  using (true);

drop policy if exists story_views_insert on public.story_views;
create policy story_views_insert on public.story_views for insert to authenticated
  with check (auth.uid() = user_id);
