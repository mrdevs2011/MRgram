-- ═══════════════════════════════════════════════════════════════════════
-- 023: XAVFSIZ PAROLNI TIKLASH (KOD ORQALI — ESKI PAROLNI O'CHIRMAYDI)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Profiles jadvaliga tiklash kodi va muddati ustunlarini qo'shish
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_code_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_attempts int DEFAULT 0;

-- 2. request_password_reset funksiyasini yangilash:
-- DIQQAT: auth.users dagi haqiqiy parolni O'CHIRMAYDI!
-- Faqat vaqtinchalik 8 xonali tasdiqlash kodini profiles ga yozib qo'yadi.
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
  if p_temp_password is null or length(trim(p_temp_password)) < 6 then
    raise exception 'Tasdiqlash kodi noto''g''ri';
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

  -- Haqiqiy parolni o'zgartirmaymiz!
  -- Faqat 15 daqiqa amal qiladigan tiklash kodini yozib qo'yamiz
  update public.profiles
  set recovery_code = trim(p_temp_password),
      recovery_code_expires_at = now() + interval '15 minutes',
      recovery_attempts = 0
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

-- 3. Kod orqali yangi parol o'rnatish RPC (Faqat to'g'ri kod kiritilganda parolni yangilaydi)
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
  if p_new_password is null or length(p_new_password) < 6 then
    raise exception 'Yangi parol kamida 6 ta belgidan iborat bo''lishi kerak';
  end if;

  if p_code is null or trim(p_code) = '' then
    raise exception 'Tasdiqlash kodini kiriting';
  end if;

  select id, email, recovery_code, recovery_code_expires_at, coalesce(recovery_attempts, 0)
  into v_uid, v_email, v_code, v_exp, v_attempts
  from public.profiles
  where username = lower(trim(p_username));

  if v_uid is null then
    raise exception 'Bunday foydalanuvchi topilmadi';
  end if;

  if v_code is null or v_exp is null then
    raise exception 'Tiklash kodi so''ralmagan yoki allaqachon ishlatilgan';
  end if;

  if now() > v_exp then
    -- Muddati o'tgan kodni tozalash
    update public.profiles set recovery_code = null, recovery_code_expires_at = null where id = v_uid;
    raise exception 'Tasdiqlash kodining 15 daqiqalik amal qilish muddati tugagan. Qaytadan so''rang.';
  end if;

  if v_attempts >= 5 then
    update public.profiles set recovery_code = null, recovery_code_expires_at = null where id = v_uid;
    raise exception 'Kod juda ko''p marta noto''g''ri kiritildi. Qaytadan kod so''rang.';
  end if;

  -- Kodni solishtirish (katta-kichik harfga sezgir bo'lmagan qilib tekshiramiz)
  if lower(trim(v_code)) != lower(trim(p_code)) then
    update public.profiles set recovery_attempts = v_attempts + 1 where id = v_uid;
    raise exception 'Tasdiqlash kodi noto''g''ri (% ta urinish qoldi)', (4 - v_attempts);
  end if;

  -- 1. auth.users da yangi shaxsiy parolni shifrlab o'rnatish
  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = v_uid;

  -- 2. profiles dagi tiklash kodini tozalash va must_change_password ni o'chirish
  update public.profiles
  set recovery_code = null,
      recovery_code_expires_at = null,
      recovery_attempts = 0,
      must_change_password = false,
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
