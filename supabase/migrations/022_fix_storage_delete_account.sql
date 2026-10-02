-- ═══════════════════════════════════════════════════════════════════════
-- 022: FIX DIRECT DELETION FROM STORAGE.OBJECTS IN ACCOUNT REMOVAL
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, storage AS $$
begin
  if not public.is_admin() then
    raise exception 'Faqat admin';
  end if;
  if p_uid = auth.uid() then
    raise exception 'O''zingizni bu yerdan o''chirib bo''lmaydi';
  end if;

  -- 1. Storage'dagi foydalanuvchiga tegishli barcha media fayllarni tozalash
  -- Supabase Storage protect_objects_delete triggeri storage.allow_delete_query = true bo'lishini talab qiladi
  begin
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects
    where bucket_id = 'media'
      and (name like p_uid::text || '/%' or (owner is not null and owner::text = p_uid::text));
  exception when others then
    -- Agar storage triggeri xatolik bersa ham profil o'chirilishi to'xtab qolmasin
    raise notice 'Storage tozalashda ogohlantirish: %', SQLERRM;
  end;

  -- 2. Push tokenlarni tozalash
  delete from public.push_tokens where user_id = p_uid;

  -- 3. Profiles qatorini o'chirish (ON DELETE CASCADE barcha bog'liq ma'lumotlarni tozalaydi)
  delete from public.profiles where id = p_uid;

  -- 4. Supabase auth.users dan o'chirish (sessiya va token butunlay bekor qilinadi)
  delete from auth.users where id = p_uid;
end $$;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- Foydalanuvchi o'z hisobini o'chirganda ham hamma narsa tozalansin
CREATE OR REPLACE FUNCTION public.delete_my_account() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, storage AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Tizimga kirilmagan';
  end if;

  -- 1. Storage ob'ektlarini tozalash
  begin
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects
    where bucket_id = 'media'
      and (name like v_uid::text || '/%' or (owner is not null and owner::text = v_uid::text));
  exception when others then
    raise notice 'Storage tozalashda ogohlantirish: %', SQLERRM;
  end;

  -- 2. Push tokenlar
  delete from public.push_tokens where user_id = v_uid;

  -- 3. Profiles (barcha jadvallar CASCADE bo'yicha o'chadi)
  delete from public.profiles where id = v_uid;

  -- 4. Auth foydalanuvchi
  delete from auth.users where id = v_uid;
end $$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
