-- SpaceMR Stories: izoh (description). Ixtiyoriy, max 200 belgi.
alter table public.stories add column if not exists caption text;

alter table public.stories drop constraint if exists stories_caption_len;
alter table public.stories add constraint stories_caption_len
  check (caption is null or char_length(caption) <= 200);

-- PostgREST sxema keshini yangilash (aks holda "caption" ustuni darhol ko'rinmaydi)
notify pgrst, 'reload schema';
