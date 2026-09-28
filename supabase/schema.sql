-- ═══════════════════════════════════════════════════════════════════════
-- MRgram — Supabase sxemasi (0 dan, migratsiyasiz)
-- Supabase Dashboard → SQL Editor'da BIR MARTA ishga tushiring.
--
-- Oldindan Dashboard'da:
--   Authentication → Providers → Email → "Confirm email" ni O'CHIRING
--   (ilova username'dan soxta email yasaydi: username@mrgram.uz)
--
-- Ishga tushgandan keyin admin qilish (o'zingiz ro'yxatdan o'tgach):
--   update public.profiles set is_admin = true, approval = 'approved'
--   where username = 'SIZNING_USERNAME';
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 0. Anon uchun hamma narsani yopamiz, kerakligini keyin ochamiz ────
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. PROFILES  (Firestore: users/{uid})
-- ═══════════════════════════════════════════════════════════════════════
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text not null check (username = lower(username) and length(username) between 2 and 40),
  full_name       text not null default '',
  email           text,
  bio             text not null default '',
  avatar          text not null default '',
  cover_url       text,
  website         text,
  location        text,
  approval        text not null default 'pending' check (approval in ('pending','approved','rejected')),
  blocked         boolean not null default false,
  blocked_until   timestamptz,               -- null + blocked=true => doimiy blok
  is_admin        boolean not null default false,
  last_seen       timestamptz,
  last_login      timestamptz,
  last_user_agent text,
  last_platform   text,
  created_at      timestamptz not null default now()
);
create unique index profiles_username_key on public.profiles (username);

-- ─── Yordamchi funksiyalar (RLS ichida rekursiyasiz ishlashi uchun security definer) ───
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.approval = 'approved'
      and (not p.blocked or (p.blocked_until is not null and p.blocked_until < now()))
  );
$$;

-- Server vaqti (Firestore _servertime_sync o'rniga)
create function public.server_now() returns timestamptz
language sql stable as $$ select now(); $$;

-- ─── Yangi auth user → profil (client o'zi profil yozmaydi, approval soxtalashtirib bo'lmaydi) ───
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uname text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
begin
  insert into public.profiles (id, username, full_name, email, avatar)
  values (
    new.id,
    uname,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), uname),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar', '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Login sahifasi uchun (anon chaqiradi) ───
create function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(p_username));
$$;

create function public.email_for_username(p_username text) returns text
language sql stable security definer set search_path = public as $$
  select email from public.profiles where username = lower(p_username);
$$;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- ─── Maxfiy ustunlarni oddiy user o'zgartira olmasin ───
create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- service_role / SQL editor (auth.uid() null) — cheklanmaydi
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.approval is distinct from old.approval
       or new.blocked is distinct from old.blocked
       or new.blocked_until is distinct from old.blocked_until
       or new.is_admin is distinct from old.is_admin
       or new.created_at is distinct from old.created_at then
      raise exception 'Bu maydonlarni faqat admin o''zgartira oladi';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin());
-- INSERT policy yo'q: profilni faqat handle_new_user() trigger yaratadi

-- ═══════════════════════════════════════════════════════════════════════
-- 2. FOLLOWS, CONTACTS, LOGIN HISTORY, PUSH
-- ═══════════════════════════════════════════════════════════════════════
create table public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);
alter table public.follows enable row level security;
create policy follows_select on public.follows for select to authenticated using (true);
create policy follows_insert on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and public.is_approved());
create policy follows_delete on public.follows for delete to authenticated
  using (follower_id = auth.uid() or public.is_admin());

create table public.contacts (
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  full_name  text not null default '',
  avatar     text not null default '',
  added_at   timestamptz not null default now(),
  primary key (owner_id, contact_id)
);
alter table public.contacts enable row level security;
create policy contacts_all on public.contacts for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_approved());

create table public.login_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('login','session')),
  at         timestamptz not null default now(),
  user_agent text,
  platform   text
);
create index login_history_user_idx on public.login_history (user_id, at desc);
alter table public.login_history enable row level security;
create policy login_history_select on public.login_history for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy login_history_insert on public.login_history for insert to authenticated
  with check (user_id = auth.uid());

-- Push tokenlar (Web Push obunasi JSON ko'rinishida)
create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  platform   text,
  created_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy push_tokens_all on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tizimga kirilmagan'; end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform;
end $$;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. POSTS, LIKES, COMMENTS
-- ═══════════════════════════════════════════════════════════════════════
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  user_full_name text not null default '',
  text           text,
  media_path     text,             -- 'media' bucket ichidagi yo'l
  media_type     text,
  media_width    int,
  media_height   int,
  file_name      text,
  file_size      bigint,
  is_public      boolean not null default false,
  is_max_private boolean not null default false,
  views          int not null default 0,
  likes_count    int not null default 0,
  comment_count  int not null default 0,
  created_at     timestamptz not null default now()
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_user_idx    on public.posts (user_id, created_at desc);

create table public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  user_name  text not null default '',
  text       text not null,
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

-- Hisoblagichlar trigger orqali (client "sakrab" o'zgartira olmaydi)
create function public.bump_post_counters() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'post_likes' then
    update public.posts set likes_count = greatest(likes_count + case when tg_op = 'INSERT' then 1 else -1 end, 0)
    where id = coalesce(new.post_id, old.post_id);
  else
    update public.posts set comment_count = greatest(comment_count + case when tg_op = 'INSERT' then 1 else -1 end, 0)
    where id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end $$;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.bump_post_counters();
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_post_counters();

create function public.increment_post_view(p_post uuid) returns void
language sql security definer set search_path = public as $$
  update public.posts set views = views + 1
  where id = p_post and auth.uid() is not null and public.is_approved()
    and (is_public or user_id = auth.uid());
$$;

alter table public.posts enable row level security;
create policy posts_select on public.posts for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or is_public);
create policy posts_insert on public.posts for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_approved() and user_id = auth.uid()
        and views = 0 and likes_count = 0 and comment_count = 0)
  );
create policy posts_update on public.posts for update to authenticated
  using ((public.is_approved() and user_id = auth.uid()) or public.is_admin())
  with check ((user_id = auth.uid()) or public.is_admin());
create policy posts_delete on public.posts for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke update on public.posts from authenticated;
grant  update (text, is_public, is_max_private) on public.posts to authenticated;

alter table public.post_likes enable row level security;
create policy likes_select on public.post_likes for select to authenticated
  using (public.is_approved() or public.is_admin());
create policy likes_insert on public.post_likes for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());
create policy likes_delete on public.post_likes for delete to authenticated
  using (user_id = auth.uid());

alter table public.comments enable row level security;
create policy comments_select on public.comments for select to authenticated
  using (public.is_approved() or public.is_admin());
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());
create policy comments_update on public.comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke update on public.comments from authenticated;
grant  update (text) on public.comments to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. 1-ga-1 CHATLAR
--    chats: ikki kishi (user_a < user_b), chat_members: har biriga unread/typing
-- ═══════════════════════════════════════════════════════════════════════
create table public.chats (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  last_message    text not null default '',
  last_sender_id  uuid,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.chat_members (
  chat_id      uuid not null references public.chats(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  unread_count int not null default 0,
  typing_until timestamptz,
  last_seen_at timestamptz,
  primary key (chat_id, user_id)
);
create index chat_members_user_idx on public.chat_members (user_id);

create function public.is_chat_member(p_chat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chats c
                 where c.id = p_chat and auth.uid() in (c.user_a, c.user_b));
$$;

create function public.get_or_create_chat(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a uuid; b uuid; cid uuid;
begin
  if me is null or not public.is_approved() then raise exception 'Ruxsat yo''q'; end if;
  if p_other = me then raise exception 'O''zingiz bilan chat ochib bo''lmaydi'; end if;
  a := least(me, p_other); b := greatest(me, p_other);
  select id into cid from public.chats where user_a = a and user_b = b;
  if cid is null then
    insert into public.chats (user_a, user_b) values (a, b) returning id into cid;
    insert into public.chat_members (chat_id, user_id) values (cid, a), (cid, b);
  end if;
  return cid;
end $$;

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.chats(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'text' check (type in ('text','voice','file')),
  text       text,
  media_path text,
  media_type text,
  file_name  text,
  file_size  bigint,
  duration   int,
  status     text not null default 'sent' check (status in ('sent','delivered','read')),
  read_at    timestamptz,
  edited_at  timestamptz,
  created_at timestamptz not null default now()
);
create index messages_chat_idx on public.messages (chat_id, created_at);

create function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.chats set
    last_message    = case new.type when 'voice' then 'Ovozli xabar'
                                    when 'file'  then coalesce(new.file_name, 'Fayl')
                                    else coalesce(new.text, '') end,
    last_sender_id  = new.sender_id,
    last_message_at = new.created_at
  where id = new.chat_id;
  update public.chat_members set unread_count = unread_count + 1
  where chat_id = new.chat_id and user_id <> new.sender_id;
  return null;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- Yuboruvchi: text/edited_at/status. Qabul qiluvchi: faqat status/read_at.
create function public.guard_message_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if auth.uid() = old.sender_id then
    if new.chat_id is distinct from old.chat_id or new.sender_id is distinct from old.sender_id
       or new.type is distinct from old.type or new.media_path is distinct from old.media_path
       or new.created_at is distinct from old.created_at then
      raise exception 'Faqat matn/holatni o''zgartirish mumkin';
    end if;
  else
    if new.text is distinct from old.text or new.edited_at is distinct from old.edited_at
       or new.chat_id is distinct from old.chat_id or new.sender_id is distinct from old.sender_id
       or new.type is distinct from old.type or new.media_path is distinct from old.media_path
       or new.created_at is distinct from old.created_at then
      raise exception 'Qabul qiluvchi faqat o''qilgan deb belgilay oladi';
    end if;
  end if;
  return new;
end $$;
create trigger messages_guard before update on public.messages
  for each row execute function public.guard_message_update();

alter table public.chats enable row level security;
create policy chats_select on public.chats for select to authenticated
  using (auth.uid() in (user_a, user_b) or public.is_admin());
create policy chats_delete on public.chats for delete to authenticated using (public.is_admin());
-- INSERT/UPDATE: faqat get_or_create_chat() va triggerlar orqali

alter table public.chat_members enable row level security;
create policy chat_members_select on public.chat_members for select to authenticated
  using (public.is_chat_member(chat_id) or public.is_admin());
create policy chat_members_update on public.chat_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.chat_members from authenticated;
grant  update (unread_count, typing_until, last_seen_at) on public.chat_members to authenticated;

alter table public.messages enable row level security;
create policy messages_select on public.messages for select to authenticated
  using (public.is_chat_member(chat_id) or public.is_admin());
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_approved() and public.is_chat_member(chat_id));
create policy messages_update on public.messages for update to authenticated
  using (public.is_chat_member(chat_id)) with check (public.is_chat_member(chat_id));
create policy messages_delete on public.messages for delete to authenticated
  using (sender_id = auth.uid() or public.is_admin());
revoke update on public.messages from authenticated;
grant  update (text, status, read_at, edited_at) on public.messages to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. GURUH VA KANALLAR
-- ═══════════════════════════════════════════════════════════════════════
create table public.groups (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('group','channel')),
  name            text not null,
  avatar          text not null default '',
  description     text not null default '',
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  is_private      boolean not null default false,
  invite_code     text unique,
  msg_permission  text not null default 'all' check (msg_permission in ('all','admins')),
  last_message    text not null default '',
  last_sender_id  uuid,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create table public.group_members (
  group_id     uuid not null references public.groups(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  unread_count int not null default 0,
  joined_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

create function public.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid());
$$;
create function public.is_group_admin(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid() and role in ('owner','admin'));
$$;
create function public.group_is_private(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_private from public.groups where id = p_group), true);
$$;
create function public.can_post_in_group(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.groups g
    join public.group_members m on m.group_id = g.id and m.user_id = auth.uid()
    where g.id = p_group
      and (
        m.role in ('owner','admin')
        or (g.type = 'group' and g.msg_permission = 'all')
      )
  );
$$;

-- Yaratuvchi avtomatik "owner" a'zo
create function public.on_group_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return null;
end $$;
create trigger groups_after_insert after insert on public.groups
  for each row execute function public.on_group_insert();

-- Yopiq guruhga taklif kodi bilan qo'shilish
create function public.join_group_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null or not public.is_approved() then raise exception 'Ruxsat yo''q'; end if;
  select id into gid from public.groups where invite_code = p_code;
  if gid is null then raise exception 'Kod noto''g''ri'; end if;
  insert into public.group_members (group_id, user_id) values (gid, auth.uid())
  on conflict do nothing;
  return gid;
end $$;

-- A'zo o'z rolini oshira olmasin
create function public.guard_member_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role
     and not (public.is_group_admin(old.group_id) or public.is_admin()) then
    raise exception 'Rolni faqat admin o''zgartira oladi';
  end if;
  return new;
end $$;
create trigger group_members_guard before update on public.group_members
  for each row execute function public.guard_member_update();

create table public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'text' check (type in ('text','file')),
  text       text,
  media_path text,
  media_type text,
  file_name  text,
  file_size  bigint,
  edited_at  timestamptz,
  created_at timestamptz not null default now()
);
create index group_messages_idx on public.group_messages (group_id, created_at);

create function public.on_group_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.groups set
    last_message    = case new.type when 'file' then coalesce(new.file_name, 'Fayl') else coalesce(new.text, '') end,
    last_sender_id  = new.sender_id,
    last_message_at = new.created_at
  where id = new.group_id;
  update public.group_members set unread_count = unread_count + 1
  where group_id = new.group_id and user_id <> new.sender_id;
  return null;
end $$;
create trigger group_messages_after_insert after insert on public.group_messages
  for each row execute function public.on_group_message_insert();

alter table public.groups enable row level security;
create policy groups_select on public.groups for select to authenticated
  using (public.is_admin() or not is_private or public.is_group_member(id));
create policy groups_insert on public.groups for insert to authenticated
  with check (public.is_admin() or (public.is_approved() and owner_id = auth.uid()));
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_admin(id) or public.is_admin())
  with check (public.is_group_admin(id) or public.is_admin());
create policy groups_delete on public.groups for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());
revoke update on public.groups from authenticated;
grant  update (name, avatar, description, is_private, invite_code, msg_permission) on public.groups to authenticated;

alter table public.group_members enable row level security;
create policy gm_select on public.group_members for select to authenticated
  using (public.is_admin() or public.is_group_member(group_id) or not public.group_is_private(group_id));
create policy gm_insert on public.group_members for insert to authenticated
  with check (
    public.is_admin()
    or public.is_group_admin(group_id)
    or (user_id = auth.uid() and role = 'member' and public.is_approved()
        and not public.group_is_private(group_id))
  );
create policy gm_update on public.group_members for update to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id) or public.is_admin());
create policy gm_delete on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id) or public.is_admin());
revoke update on public.group_members from authenticated;
grant  update (role, unread_count) on public.group_members to authenticated;

alter table public.group_messages enable row level security;
create policy gmsg_select on public.group_messages for select to authenticated
  using (public.is_admin() or public.is_group_member(group_id));
create policy gmsg_insert on public.group_messages for insert to authenticated
  with check (
    sender_id = auth.uid() and public.is_approved()
    and (public.can_post_in_group(group_id) or public.is_admin())
  );
create policy gmsg_update on public.group_messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy gmsg_delete on public.group_messages for delete to authenticated
  using (sender_id = auth.uid() or public.is_group_admin(group_id) or public.is_admin());
revoke update on public.group_messages from authenticated;
grant  update (text, edited_at) on public.group_messages to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. QO'NG'IROQLAR (WebRTC signaling)
-- ═══════════════════════════════════════════════════════════════════════
create table public.calls (
  id                uuid primary key default gen_random_uuid(),
  caller_id         uuid not null references public.profiles(id) on delete cascade,
  callee_id         uuid not null references public.profiles(id) on delete cascade,
  type              text not null check (type in ('voice','video')),
  status            text not null default 'ringing',
  offer             jsonb not null,
  answer            jsonb,
  caller_candidates jsonb not null default '[]',
  callee_candidates jsonb not null default '[]',
  video_offer       jsonb,   -- qo'ng'iroq ichida video yoqilganda qayta muzokara (renegotiation)
  video_answer      jsonb,
  created_at        timestamptz not null default now()
);
create index calls_callee_idx on public.calls (callee_id, created_at desc);

-- ICE candidate'larni atomik qo'shish (parallel yozuvlar bir-birini bosmasin)
create function public.append_call_candidate(p_call uuid, p_candidate jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.calls set
    caller_candidates = case when caller_id = auth.uid() then caller_candidates || jsonb_build_array(p_candidate) else caller_candidates end,
    callee_candidates = case when callee_id = auth.uid() then callee_candidates || jsonb_build_array(p_candidate) else callee_candidates end
  where id = p_call and auth.uid() in (caller_id, callee_id);
end $$;

create function public.guard_call_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.caller_id is distinct from old.caller_id or new.callee_id is distinct from old.callee_id
     or new.type is distinct from old.type or new.offer is distinct from old.offer
     or new.created_at is distinct from old.created_at then
    raise exception 'Qo''ng''iroq asosiy maydonlari o''zgarmaydi';
  end if;
  if auth.uid() = old.caller_id and (new.answer is distinct from old.answer
     or new.callee_candidates is distinct from old.callee_candidates) then
    raise exception 'Chaqiruvchi callee maydonlariga tega olmaydi';
  end if;
  if auth.uid() = old.callee_id and new.caller_candidates is distinct from old.caller_candidates then
    raise exception 'Qabul qiluvchi caller maydonlariga tega olmaydi';
  end if;
  return new;
end $$;
create trigger calls_guard before update on public.calls
  for each row execute function public.guard_call_update();

alter table public.calls enable row level security;
create policy calls_select on public.calls for select to authenticated
  using (auth.uid() in (caller_id, callee_id) or public.is_admin());
create policy calls_insert on public.calls for insert to authenticated
  with check (public.is_admin() or (caller_id = auth.uid() and public.is_approved()));
create policy calls_update on public.calls for update to authenticated
  using (auth.uid() in (caller_id, callee_id) or public.is_admin());
create policy calls_delete on public.calls for delete to authenticated
  using (auth.uid() in (caller_id, callee_id) or public.is_admin());
revoke update on public.calls from authenticated;
grant  update (status, answer, caller_candidates, callee_candidates, video_offer, video_answer) on public.calls to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. ADMIN: e'lon, e'lonlar tarixi, audit log
-- ═══════════════════════════════════════════════════════════════════════
create table public.admin_notice (          -- faqat 1 qator: id = 'global'
  id         text primary key default 'global' check (id = 'global'),
  text       text not null,
  target     text not null default 'all',
  admin_id   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.admin_notice enable row level security;
create policy notice_select on public.admin_notice for select to authenticated using (true);
create policy notice_write  on public.admin_notice for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.broadcast_history (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  target     text not null default 'all',
  admin_id   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.broadcast_history enable row level security;
create policy bh_select on public.broadcast_history for select to authenticated using (public.is_admin());
create policy bh_insert on public.broadcast_history for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

create table public.admin_actions (         -- o'zgarmas audit log
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  target_uid  uuid,
  target_name text,
  details     text,
  admin_id    uuid references public.profiles(id) on delete set null,
  admin_name  text,
  created_at  timestamptz not null default now()
);
create index admin_actions_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
create policy aa_select on public.admin_actions for select to authenticated using (public.is_admin());
create policy aa_insert on public.admin_actions for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());
-- UPDATE/DELETE policy yo'q => o'zgartirib bo'lmaydi

-- ═══════════════════════════════════════════════════════════════════════
-- 8. STORAGE  (bucket 'media', ommaviy o'qish; yuklash faqat o'z papkasiga)
--    Yo'l formati: {user_id}/{papka}/{fayl}
-- ═══════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 52428800)
on conflict (id) do nothing;

create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_approved());
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ═══════════════════════════════════════════════════════════════════════
-- 9. REALTIME  (RLS realtime'ga ham amal qiladi)
-- ═══════════════════════════════════════════════════════════════════════
alter table public.messages       replica identity full;
alter table public.group_messages replica identity full;
alter table public.calls          replica identity full;
alter table public.chat_members   replica identity full;
alter table public.group_members  replica identity full;
alter table public.post_likes     replica identity full;
alter table public.comments       replica identity full;

alter publication supabase_realtime add table
  public.messages, public.group_messages, public.chats, public.chat_members,
  public.groups, public.group_members, public.calls,
  public.posts, public.post_likes, public.comments,
  public.profiles, public.admin_notice;

-- ═══════════════════════════════════════════════════════════════════════
-- 10. HISOBNI O'CHIRISH  (client: sb.rpc('delete_my_account'))
-- Firebase'dagi /api/delete-user o'rnini bosadi. auth.users dan o'chirilgach
-- profiles va unga bog'liq hamma jadval (on delete cascade) tozalanadi.
-- Storage fayllarini client o'zi oldindan o'chiradi (auth.js → _purgeMyMedia).
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'Tizimga kirilmagan';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 11. ADMIN: boshqa foydalanuvchini o'chirish + push tokenlarni ko'rish
--     (Firebase'dagi /api/delete-user o'rnini bosadi)
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.admin_delete_user(p_uid uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Faqat admin';
  end if;
  if p_uid = auth.uid() then
    raise exception 'O''zingizni bu yerdan o''chirib bo''lmaydi';
  end if;
  delete from auth.users where id = p_uid;
end $$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

create policy push_tokens_admin_select on public.push_tokens
  for select to authenticated using (public.is_admin());
