-- 017 (2026-10-01 bazada): fayl ostida matn (caption) bo'lganda last_message prevyusi
CREATE OR REPLACE FUNCTION public.on_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.chats set
    last_message    = case new.type when 'voice' then 'Ovozli xabar'
                                    when 'file'  then coalesce(nullif(new.text, ''), new.file_name, 'Fayl')
                                    else coalesce(new.text, '') end,
    last_sender_id  = new.sender_id,
    last_message_at = new.created_at
  where id = new.chat_id;
  update public.chat_members set unread_count = unread_count + 1
  where chat_id = new.chat_id and user_id <> new.sender_id;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.on_group_message_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.groups set
    last_message    = case new.type when 'voice' then 'Ovozli xabar'
                                    when 'file'  then coalesce(nullif(new.text, ''), new.file_name, 'Fayl')
                                    else coalesce(new.text, '') end,
    last_sender_id  = new.sender_id,
    last_message_at = new.created_at
  where id = new.group_id;
  update public.group_members set unread_count = unread_count + 1
  where group_id = new.group_id and user_id <> new.sender_id;
  return null;
end $function$;
