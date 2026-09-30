-- DIET Faza 7.2: admin uchun Storage sarfi (media bucket, bayt). Idempotent.
-- expand bosqichi: kod (modules/admin-storage.js) RPC yo'q bo'lsa jim ishlaydi,
-- shuning uchun bu patchni istalgan vaqtda ishga tushirish mumkin.
create or replace function public.admin_storage_usage()
returns bigint
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return coalesce((
    select sum((metadata->>'size')::bigint)
    from storage.objects
    where bucket_id = 'media'
  ), 0);
end;
$$;

revoke all on function public.admin_storage_usage() from public;
grant execute on function public.admin_storage_usage() to authenticated;
