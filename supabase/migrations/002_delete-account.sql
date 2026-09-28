-- ═══════════════════════════════════════════════════════════════════════
-- Hisobni o'chirish (client: sb.rpc('delete_my_account'))
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
