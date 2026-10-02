-- 029: Foydalanuvchi vaqtinchalik 8 xonali kod bilan kirganda, albatta parolni almashtirishni talab qilish.
-- Agar ular kodni parol o'rnida ishlatsa (p_code = p_new_password), must_change_password = true qilinadi.

DROP FUNCTION IF EXISTS public.reset_password_with_code(text, text, text);

CREATE OR REPLACE FUNCTION public.reset_password_with_code(
  p_username text,
  p_code text,
  p_new_password text
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions AS $$
declare
  v_uid uuid;
  v_email text;
  v_code text;
  v_exp timestamptz;
  v_attempts int;
begin
  if p_new_password is null or length(trim(p_new_password)) < 6 then
    raise exception 'Yangi parol kamida 6 ta belgidan iborat bo''lishi kerak';
  end if;

  if p_code is null or trim(p_code) = '' then
    raise exception 'Tasdiqlash kodini kiriting';
  end if;

  select id, email, recovery_code, recovery_code_expires_at, coalesce(recovery_attempts, 0)
  into v_uid, v_email, v_code, v_exp, v_attempts
  from public.profiles
  where lower(username) = lower(trim(p_username));

  if v_uid is null then
    raise exception 'Bunday foydalanuvchi topilmadi';
  end if;

  if v_code is null or v_exp is null then
    raise exception 'Tiklash kodi so''ralmagan yoki allaqachon ishlatilgan';
  end if;

  if now() > v_exp then
    -- Muddati o'tgan kodni tozalash
    update public.profiles set recovery_code = null, recovery_code_expires_at = null where id = v_uid;
    raise exception 'Tasdiqlash kodining amal qilish muddati tugagan. Qaytadan so''rang.';
  end if;

  if v_attempts >= 5 then
    update public.profiles set recovery_code = null, recovery_code_expires_at = null where id = v_uid;
    raise exception 'Kod juda ko''p marta noto''g''ri kiritildi. Qaytadan kod so''rang.';
  end if;

  -- Kodni solishtirish (katta-kichik harfga sezgir bo'lmagan qilib tekshiramiz)
  if lower(trim(v_code)) != lower(trim(p_code)) then
    update public.profiles set recovery_attempts = v_attempts + 1 where id = v_uid;
    raise exception 'Tasdiqlash kodi noto''g''ri (% ta urinish qoldi)', (5 - (v_attempts + 1));
  end if;

  -- 1. auth.users da yangi shaxsiy parolni shifrlab o'rnatish
  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = v_uid;

  -- 2. profiles dagi tiklash kodini tozalash va must_change_password ni SOZLASh
  -- Agar ular kodning o'zini parol sifatida jo'natishgan bo'lsa (login ekranidan), must_change_password = true bo'ladi!
  update public.profiles
  set recovery_code = null,
      recovery_code_expires_at = null,
      recovery_attempts = 0,
      must_change_password = case when trim(p_code) = trim(p_new_password) then true else false end,
      password_changed_at = now()
  where id = v_uid;

  return json_build_object(
    'ok', true,
    'username', lower(trim(p_username)),
    'email', v_email,
    'message', 'Parol muvaffaqiyatli yangilandi'
  );
end $$;

REVOKE ALL ON FUNCTION public.reset_password_with_code(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_password_with_code(text, text, text) TO anon, authenticated;
