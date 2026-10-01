-- 016 (expand, istalgan vaqtda): guruhda ovozli xabar (DM bilan bir xil)
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS duration integer;
ALTER TABLE public.group_messages DROP CONSTRAINT IF EXISTS group_messages_type_check;
ALTER TABLE public.group_messages ADD CONSTRAINT group_messages_type_check
  CHECK (type = ANY (ARRAY['text'::text, 'voice'::text, 'file'::text]));
