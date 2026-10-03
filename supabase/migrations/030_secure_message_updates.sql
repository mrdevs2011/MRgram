-- 1. Prevent users from editing other people's DM messages
CREATE OR REPLACE FUNCTION public.check_message_update_security()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user updating is NOT the sender and NOT an admin
  IF OLD.sender_id != auth.uid() AND NOT public.is_admin() THEN
    -- They can only change status and read_at
    IF NEW.text IS DISTINCT FROM OLD.text 
       OR NEW.media_path IS DISTINCT FROM OLD.media_path 
       OR NEW.edited_at IS DISTINCT FROM OLD.edited_at
       OR NEW.type IS DISTINCT FROM OLD.type THEN
       RAISE EXCEPTION 'Security violation: Cannot edit other users messages';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_message_update_security ON public.messages;
CREATE TRIGGER tr_check_message_update_security
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_message_update_security();

-- 2. Do the same for group_messages
CREATE OR REPLACE FUNCTION public.check_group_message_update_security()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user updating is NOT the sender, NOT a group admin, and NOT an admin
  IF OLD.sender_id != auth.uid() AND NOT public.is_group_admin(OLD.group_id) AND NOT public.is_admin() THEN
    IF NEW.text IS DISTINCT FROM OLD.text 
       OR NEW.media_path IS DISTINCT FROM OLD.media_path 
       OR NEW.edited_at IS DISTINCT FROM OLD.edited_at
       OR NEW.type IS DISTINCT FROM OLD.type THEN
       RAISE EXCEPTION 'Security violation: Cannot edit other users group messages';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_group_message_update_security ON public.group_messages;
CREATE TRIGGER tr_check_group_message_update_security
  BEFORE UPDATE ON public.group_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_group_message_update_security();
