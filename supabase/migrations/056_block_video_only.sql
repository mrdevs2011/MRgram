-- 056: Siyosat o'zgardi (054/055 ni almashtiradi): VIDEO taqiqlangan, qolgan hamma fayl (rasm formatlari, PDF/Word/Excel/ZIP, audio...) ruxsat.
-- Istisno: story/avatar/guruh avatari faqat RASM. Idempotent.

update storage.buckets set allowed_mime_types = null where id = 'media';

create or replace function public.enforce_only_jpg_png_storage()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_mime  text := lower(split_part(coalesce(new.metadata->>'mimetype', ''), ';', 1));
  v_ext   text := lower(coalesce(substring(new.name from '\.([A-Za-z0-9]+)$'), ''));
  v_voice boolean := new.name ~ '^[^/]+/chat-voice/' and v_ext in ('webm','ogg','opus','mp4','m4a','mp3','wav');
  v_imgonly boolean := new.name ~ '^[^/]+/(stories|avatars|group-avatars)/';
begin
  if v_voice and (v_mime = '' or v_mime like 'audio/%') then
    return new;
  end if;
  if v_mime like 'video/%'
     or (v_ext in ('mp4','mov','mkv','avi','m4v','wmv','flv','3gp','mpg','mpeg','ogv','webm') and v_mime not like 'audio/%') then
    raise exception 'Video yuklash mumkin emas' using errcode = '22023';
  end if;
  if v_imgonly then
    if not (v_mime like 'image/%' or (v_mime = '' and v_ext in ('jpg','jpeg','png','gif','webp','avif','svg','heic','heif','bmp'))) then
      raise exception 'Bu yerga faqat rasm qo''yish mumkin' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

create or replace function public.enforce_no_video_audio_rows()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  j       jsonb := to_jsonb(new);
  v_mt    text := lower(split_part(coalesce(new.media_type, ''), ';', 1));
  v_ext   text := lower(coalesce(substring(new.media_path from '\.([A-Za-z0-9]+)$'), ''));
  v_voice boolean := tg_table_name in ('messages','group_messages') and j->>'type' = 'voice';
begin
  if v_voice then
    return new;
  end if;
  if tg_table_name = 'stories' then
    if not (v_mt = 'image' or v_mt like 'image/%') then
      raise exception 'Storyga faqat rasm qo''yish mumkin' using errcode = '22023';
    end if;
    return new;
  end if;
  if v_mt = 'video' or v_mt like 'video/%'
     or (v_ext in ('mp4','mov','mkv','avi','m4v','wmv','flv','3gp','mpg','mpeg','ogv','webm') and v_mt not like 'audio/%') then
    raise exception 'Video yuklash mumkin emas' using errcode = '22023';
  end if;
  return new;
end $$;
