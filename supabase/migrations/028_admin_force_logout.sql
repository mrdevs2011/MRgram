-- 028: Admin parol tiklashda foydalanuvchini butunlay tizimdan chiqarib yuborish (logout)

DROP FUNCTION IF EXISTS public.admin_reset_user_password(uuid, text);
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(p_uid uuid, p_temp_password text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions AS $$
declare
  v_rec text;
  v_uname text;
  v_masked text;
  v_len int;
begin
  if not public.is_admin() then
    raise exception 'Faqat administrator amalga oshira oladi';
  end if;
  if p_uid = auth.uid() then
    raise exception 'O''zingizning parolingizni profil sozlamalaridan o''zgartiring';
  end if;
  if p_temp_password is null or length(trim(p_temp_password)) < 6 then
    raise exception 'Tiklash kodi kamida 6 ta belgi bo''lishi kerak';
  end if;

  select username, recovery_email into v_uname, v_rec
  from public.profiles
  where id = p_uid;

  if v_uname is null then
    raise exception 'Foydalanuvchi topilmadi';
  end if;

  -- Foydalanuvchining joriy paroli o'z kuchida qoladi.
  -- 24 soat amal qiladigan vaqtinchalik tiklash kodi (OTP) yoziladi:
  update public.profiles
  set recovery_code = trim(p_temp_password),
      recovery_code_expires_at = now() + interval '24 hours',
      recovery_attempts = 0
  where id = p_uid;

  -- BARCHA SESSIYALARNI O'CHIRISH (BUTUNLAY LOGOUT)
  delete from auth.sessions where user_id = p_uid;
  delete from auth.refresh_tokens where parent like '%' || p_uid::text || '%';

  if v_rec is not null and trim(v_rec) != '' then
    v_len := position('@' in v_rec);
    if v_len > 3 then
      v_masked := substr(v_rec, 1, 1) || '***' || substr(v_rec, v_len - 1);
    else
      v_masked := '***' || substr(v_rec, v_len);
    end if;
  end if;

  return json_build_object(
    'ok', true,
    'uid', p_uid,
    'username', v_uname,
    'recovery_email', v_rec,
    'masked_email', v_masked,
    'code', trim(p_temp_password)
  );
end $$;
