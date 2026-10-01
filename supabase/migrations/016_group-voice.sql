-- 016 (2026-10-01 bazada): guruhda ovozli xabar (DM bilan bir xil)
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS duration integer;
ALTER TABLE public.group_messages DROP CONSTRAINT IF EXISTS group_messages_type_check;
ALTER TABLE public.group_messages ADD CONSTRAINT group_messages_type_check
  CHECK (type = ANY (ARRAY['text'::text, 'voice'::text, 'file'::text]));

-- Guruhda ovozli xabar kelganda last_message 'Ovozli xabar' bo'lib saqlansin
CREATE OR REPLACE FUNCTION public.on_group_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.groups set
    last_message    = case new.type when 'voice' then 'Ovozli xabar'
                                    when 'file'  then coalesce(new.file_name, 'Fayl')
                                    else coalesce(new.text, '') end,
    last_sender_id  = new.sender_id,
    last_message_at = new.created_at
  where id = new.group_id;
  update public.group_members set unread_count = unread_count + 1
  where group_id = new.group_id and user_id <> new.sender_id;
  return null;
end $function$;
