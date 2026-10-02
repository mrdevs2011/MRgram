-- ═══════════════════════════════════════════════════════════════════════
-- 024: TIKLASH KODINI TEKSHIRISH (VERIFY RECOVERY CODE RPC)
-- Foydalanuvchi login parol maydoniga emailga kelgan 8 xonali kodni
-- kiritganda yoki kodni kiritish oynasini ochganda tekshirish imkonini beradi.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.verify_recovery_code(
  p_username text,
  p_code text
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions AS $$
declare
  v_uid uuid;
  v_rec text;
  v_code text;
  v_exp timestamptz;
  v_masked text;
  v_len int;
begin
  if p_username is null or p_code is null or trim(p_code) = '' then
    return json_build_object('valid', false);
  end if;

  select id, recovery_email, recovery_code, recovery_code_expires_at
  into v_uid, v_rec, v_code, v_exp
  from public.profiles
  where username = lower(trim(p_username));

  if v_uid is null or v_code is null or v_exp is null then
    return json_build_object('valid', false);
  end if;

  if now() > v_exp then
    return json_build_object('valid', false, 'expired', true);
  end if;

  if lower(trim(v_code)) = lower(trim(p_code)) then
    if v_rec is not null then
      v_len := position('@' in v_rec);
      if v_len > 3 then
        v_masked := substr(v_rec, 1, 1) || '***' || substr(v_rec, v_len - 1);
      else
        v_masked := '***' || substr(v_rec, v_len);
      end if;
    end if;

    return json_build_object(
      'valid', true,
      'username', lower(trim(p_username)),
      'masked_email', v_masked
    );
  end if;

  return json_build_object('valid', false);
end $$;

REVOKE ALL ON FUNCTION public.verify_recovery_code(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_recovery_code(text, text) TO anon, authenticated;
