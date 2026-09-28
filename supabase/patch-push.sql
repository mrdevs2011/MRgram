-- ═══════════════════════════════════════════════════════════════════════
-- Web Push obunasini ro'yxatdan o'tkazish (client: sb.rpc('register_push_token'))
-- push_tokens.token = JSON.stringify(PushSubscription). Bir qurilmada akkaunt
-- almashsa, oddiy upsert RLS'ga tiqilardi — shuning uchun security definer RPC.
-- schema.sql ni yangidan ishga tushirgan bo'lsangiz kerak emas (u yerga ham qo'shilgan).
-- ═══════════════════════════════════════════════════════════════════════
create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tizimga kirilmagan'; end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform;
end $$;
grant execute on function public.register_push_token(text, text) to authenticated;
