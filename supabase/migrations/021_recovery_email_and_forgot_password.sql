-- ═══════════════════════════════════════════════════════════════════════
-- 021: ZAXIRA EMAIL VA PAROLNI TIKLASH (FORGOT PASSWORD)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Profiles jadvaliga zaxira email ustunini qo'shish
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_email text;

-- 2. Yangi foydalanuvchi ro'yxatdan o'tganda recovery_email ni profiles ga yozish
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
declare
  uname text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  rec_email text := nullif(trim(new.raw_user_meta_data->>'recovery_email'), '');
begin
  insert into public.profiles (id, username, full_name, email, avatar, recovery_email)
  values (
    new.id,
    uname,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), uname),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar', ''),
    rec_email
  );
  return new;
end $$;

-- 3. Foydalanuvchi zaxira emaili mavjudligini tekshirish RPC
CREATE OR REPLACE FUNCTION public.check_user_recovery(p_username text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
declare
  v_rec text;
  v_masked text;
  v_len int;
begin
  select recovery_email into v_rec
  from public.profiles
  where username = lower(trim(p_username));

  if not found then
    return json_build_object('exists', false);
  end if;

  if v_rec is null or trim(v_rec) = '' then
    return json_build_object('exists', true, 'has_recovery', false);
  end if;

  v_len := position('@' in v_rec);
  if v_len > 3 then
    v_masked := substr(v_rec, 1, 1) || '***' || substr(v_rec, v_len - 1);
  else
    v_masked := '***' || substr(v_rec, v_len);
  end if;

  return json_build_object(
    'exists', true,
    'has_recovery', true,
    'masked_email', v_masked
  );
end $$;

REVOKE ALL ON FUNCTION public.check_user_recovery(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_user_recovery(text) TO anon, authenticated;

-- 4. Parolni tiklashni so'rash: 8 xonali vaqtinchalik parol o'rnatish va must_change_password ni yoqish
CREATE OR REPLACE FUNCTION public.request_password_reset(p_username text, p_temp_password text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions AS $$
declare
  v_uid uuid;
  v_rec text;
  v_masked text;
  v_len int;
begin
  if p_temp_password is null or length(p_temp_password) < 6 then
    raise exception 'Vaqtinchalik parol noto''g''ri';
  end if;

  select id, recovery_email into v_uid, v_rec
  from public.profiles
  where username = lower(trim(p_username));

  if v_uid is null then
    raise exception 'Bunday foydalanuvchi topilmadi';
  end if;

  if v_rec is null or trim(v_rec) = '' then
    raise exception 'Ushbu hisobga zaxira email biriktirilmagan. Administratorga murojaat qiling.';
  end if;

  -- auth.users da yangi vaqtinchalik parolni shifrlab saqlash
  update auth.users
  set encrypted_password = extensions.crypt(p_temp_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = v_uid;

  -- profiles da majburiy yangi parol kiritish holatini yoqish
  update public.profiles
  set must_change_password = true,
      password_changed_at = now()
  where id = v_uid;

  v_len := position('@' in v_rec);
  if v_len > 3 then
    v_masked := substr(v_rec, 1, 1) || '***' || substr(v_rec, v_len - 1);
  else
    v_masked := '***' || substr(v_rec, v_len);
  end if;

  return json_build_object(
    'ok', true,
    'uid', v_uid,
    'recovery_email', v_rec,
    'masked_email', v_masked
  );
end $$;

REVOKE ALL ON FUNCTION public.request_password_reset(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_password_reset(text, text) TO anon, authenticated;
