-- 018: Ommaviy va maxfiy guruhlar (username + 64-xonali invite_code)
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS invite_code text;

-- Ommaviy guruh username lari uchun unikal indeks (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS groups_username_idx ON public.groups (lower(username)) WHERE username IS NOT NULL;

-- Username formati (kichik harflar, raqamlar, pastki chiziq, 2-40 belgi)
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_username_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_username_check
  CHECK (username IS NULL OR (username = lower(username) AND length(username) >= 2 AND length(username) <= 40 AND username ~ '^[a-z0-9_]+$'));

-- username_available funksiyasini yangilash: profiles VA groups da tekshiradi
CREATE OR REPLACE FUNCTION public.username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select not exists (
    select 1 from public.profiles where username = lower(p_username)
  ) and not exists (
    select 1 from public.groups where username is not null and lower(username) = lower(p_username)
  );
$$;

GRANT ALL ON FUNCTION public.username_available(text) TO anon;
GRANT ALL ON FUNCTION public.username_available(text) TO authenticated;
GRANT ALL ON FUNCTION public.username_available(text) TO service_role;

-- 64-xonali invite_code yoki ommaviy username orqali guruhga qo'shilish
CREATE OR REPLACE FUNCTION public.join_group_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_group record;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Avtorizatsiyadan o''tilmagan');
  end if;

  select * into v_group from public.groups
  where (invite_code = p_token)
     or (lower(username) = lower(p_token) and is_private = false)
  limit 1;

  if v_group.id is null then
    return json_build_object('success', false, 'error', 'Guruh topilmadi yoki havola yaroqsiz');
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;

  return json_build_object('success', true, 'group_id', v_group.id, 'name', v_group.name, 'username', v_group.username);
end;
$$;

GRANT ALL ON FUNCTION public.join_group_by_token(text) TO anon;
GRANT ALL ON FUNCTION public.join_group_by_token(text) TO authenticated;
GRANT ALL ON FUNCTION public.join_group_by_token(text) TO service_role;
