-- 055: 054 ni tuzatish — ovozli xabar (audio) qaytarildi. Video va boshqa hamma narsa taqiqligicha qoladi.
-- Audio FAQAT '{uid}/chat-voice/' papkasida va faqat messages/group_messages type='voice' uchun.
-- Idempotent.

-- Bucket MIME ro'yxati olib tashlandi: MediaRecorder 'audio/webm;codecs=opus' kabi parametrli MIME yuboradi,
-- Storage API ro'yxati uni rad etishi mumkin. Cheklov quyidagi triggerlarda (kengaytma + papka + MIME).
update storage.buckets set allowed_mime_types = null where id = 'media';

create or replace function public.enforce_only_jpg_png_storage()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_mime text := lower(split_part(coalesce(new.metadata->>'mimetype', ''), ';', 1));
  v_voice boolean := new.name ~ '^[^/]+/chat-voice/' and new.name ~* '\.(webm|ogg|opus|mp4|m4a|mp3|wav)$';
begin
  if v_voice then
    if v_mime <> '' and v_mime not like 'audio/%' then
      raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
    end if;
    return new;
  end if;
  if new.name !~* '\.(jpe?g|png)$' then
    raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
  end if;
  if v_mime <> '' and v_mime not in ('image/jpeg','image/jpg','image/png') then
    raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
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
  v_voice boolean := tg_table_name in ('messages','group_messages') and j->>'type' = 'voice';
  v_mt    text := lower(split_part(coalesce(new.media_type, ''), ';', 1));
begin
  if v_voice then
    if v_mt <> '' and v_mt not like 'audio/%' then
      raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
    end if;
    if new.media_path is not null and new.media_path !~* '\.(webm|ogg|opus|mp4|m4a|mp3|wav)$' then
      raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
    end if;
    return new;
  end if;
  if v_mt <> '' and v_mt not in ('image','image/jpeg','image/jpg','image/png') then
    raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
  end if;
  if new.media_path is not null and new.media_path !~* '\.(jpe?g|png)$' then
    raise exception 'Faqat JPG va PNG rasm yuklash mumkin' using errcode = '22023';
  end if;
  return new;
end $$;
