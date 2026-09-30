-- DIET Faza 7.7: mijoz xatolari (ixtiyoriy). Idempotent.
-- Kod (modules/error-log.js) jadval yo'q bo'lsa jim ishlayveradi, shuning uchun
-- bu patchni istalgan vaqtda ishga tushirish mumkin (contract emas, expand).
create table if not exists public.client_errors (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  message    text not null,
  source     text,
  stack      text,
  ua         text,
  created_at timestamptz not null default now()
);

alter table public.client_errors enable row level security;

drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists client_errors_admin_read on public.client_errors;
create policy client_errors_admin_read on public.client_errors
  for select to authenticated using (public.is_admin());

drop policy if exists client_errors_admin_delete on public.client_errors;
create policy client_errors_admin_delete on public.client_errors
  for delete to authenticated using (public.is_admin());

-- 30 kundan eskisini tozalash (qo'lda yoki pg_cron bilan):
-- delete from public.client_errors where created_at < now() - interval '30 days';
