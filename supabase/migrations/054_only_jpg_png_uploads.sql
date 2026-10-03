-- 054: SpaceMR da faqat JPG va PNG rasm yuklash mumkin. Video/audio/hujjat taqiqlangan.
-- Idempotent. Eski qatorlarga tegmaydi (faqat yangi INSERT/UPLOAD tekshiriladi).

-- 1) Storage bucket: Storage API darajasida MIME cheklovi
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png']
 where id = 'media';

-- 2) storage.objects: kengaytma (va bor bo'lsa MIME) bo'yicha ikkinchi qatlam
create or replace function public.enforce_only_jpg_png_storage()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_mime text := lower(coalesce(new.metadata->>'mimetype', ''));
begin
  if new.name !~* '\.(jpe?g|png)$' then
    raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
  end if;
  if v_mime <> '' and v_mime not in ('image/jpeg','image/jpg','image/png') then
    raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists trg_only_jpg_png_storage on storage.objects;
create trigger trg_only_jpg_png_storage
  before insert on storage.objects
  for each row execute function public.enforce_only_jpg_png_storage();

-- 3) Jadvallar: yangi qatorlarda video/audio turini taqiqlash (faqat INSERT)
create or replace function public.enforce_no_video_audio_rows()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_mt text := lower(coalesce(new.media_type, ''));
begin
  if tg_table_name in ('messages','group_messages') and new.type = 'voice' then
    raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
  end if;
  if v_mt <> '' and v_mt not in ('image','image/jpeg','image/jpg','image/png') then
    raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
  end if;
  if new.media_path is not null and new.media_path !~* '\.(jpe?g|png)$' then
    raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists trg_only_jpg_png_rows on public.messages;
create trigger trg_only_jpg_png_rows before insert on public.messages
  for each row execute function public.enforce_no_video_audio_rows();

drop trigger if exists trg_only_jpg_png_rows on public.group_messages;
create trigger trg_only_jpg_png_rows before insert on public.group_messages
  for each row execute function public.enforce_no_video_audio_rows();

drop trigger if exists trg_only_jpg_png_rows on public.posts;
create trigger trg_only_jpg_png_rows before insert on public.posts
  for each row execute function public.enforce_no_video_audio_rows();

drop trigger if exists trg_only_jpg_png_rows on public.stories;
create trigger trg_only_jpg_png_rows before insert on public.stories
  for each row execute function public.enforce_no_video_audio_rows();
