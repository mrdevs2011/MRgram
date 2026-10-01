-- ═══════════════════════════════════════════════════════════════════════
-- 020: PAROLNI XAVFSIZ TIKLASH VA BARCHA BOSHQALARDAN LOGOUT QILISH
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Profiles jadvaliga must_change_password va password_changed_at ustunlari
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_changed_at timestamp with time zone DEFAULT now();

-- 2. Admin tomonidan foydalanuvchi parolini xavfsiz tiklash (auth.users + profiles)
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(p_uid uuid, p_temp_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions AS $$
begin
  if not public.is_admin() then
    raise exception 'Faqat administrator amalga oshira oladi';
  end if;
  if p_uid = auth.uid() then
    raise exception 'O''zingizning parolingizni profil sozlamalaridan o''zgartiring';
  end if;
  if p_temp_password is null or length(p_temp_password) < 6 then
    raise exception 'Parol kamida 6 ta belgi bo''lishi kerak';
  end if;

  -- 1. auth.users jadvalida parolni yangilash
  update auth.users
  set encrypted_password = extensions.crypt(p_temp_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_uid;

  -- 2. profiles jadvalida majburiy yangilash holatini yoqish va vaqtni muhrlash
  update public.profiles
  set must_change_password = true,
      password_changed_at = now()
  where id = p_uid;
end $$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;

-- 3. Foydalanuvchi yangi parolni o'rnatgach must_change_password ni o'chirish va vaqtni yangilash
CREATE OR REPLACE FUNCTION public.user_password_updated()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
begin
  if auth.uid() is null then
    raise exception 'Tizimga kirilmagan';
  end if;

  update public.profiles
  set must_change_password = false,
      password_changed_at = now()
  where id = auth.uid();
end $$;

REVOKE ALL ON FUNCTION public.user_password_updated() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_password_updated() TO authenticated;
