-- ═══════════════════════════════════════════════════════════════════════
-- 025: XAVFSIZ VA ATOMIK PAROL O'ZGARTIRISH (CHANGE_MY_PASSWORD RPC)
-- Foydalanuvchi joriy parolini kiritganda bcrypt orqali to'g'ridan-to'g'ri
-- bazada tekshiradi va to'g'ri bo'lsa yangi parolni atomik o'rnatadi.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.change_my_password(
  p_old_password text,
  p_new_password text
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions AS $$
declare
  v_uid uuid;
  v_enc text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Avtorizatsiyadan o''tilmagan';
  end if;

  if p_old_password is null or trim(p_old_password) = '' then
    raise exception 'Joriy parolni kiriting';
  end if;

  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'Yangi parol kamida 6 ta belgidan iborat bo''lishi kerak';
  end if;

  select encrypted_password into v_enc
  from auth.users
  where id = v_uid;

  if v_enc is null then
    raise exception 'Foydalanuvchi topilmadi';
  end if;

  -- Joriy parolni tekshiramiz (extensions.crypt yordamida)
  if v_enc != extensions.crypt(p_old_password, v_enc) then
    raise exception 'Joriy parol noto''g''ri';
  end if;

  -- Yangi parolni shifrlab o'rnatamiz
  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = v_uid;

  -- profiles dagi password_changed_at va must_change_password ni yangilaymiz
  update public.profiles
  set must_change_password = false,
      password_changed_at = now()
  where id = v_uid;

  return json_build_object('ok', true, 'message', 'Parol muvaffaqiyatli yangilandi');
end $$;

REVOKE ALL ON FUNCTION public.change_my_password(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.change_my_password(text, text) TO authenticated;
