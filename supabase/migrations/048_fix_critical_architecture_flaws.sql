-- 1. Transfer group ownership instead of destroying groups when owner deletes account
CREATE OR REPLACE FUNCTION public.transfer_groups_on_profile_delete()
RETURNS TRIGGER AS $$
DECLARE
    g record;
    new_owner uuid;
BEGIN
    FOR g IN SELECT id FROM public.groups WHERE owner_id = OLD.id LOOP
        -- find oldest admin
        SELECT user_id INTO new_owner FROM public.group_members 
        WHERE group_id = g.id AND user_id != OLD.id AND role = 'admin' 
        ORDER BY joined_at ASC LIMIT 1;
        
        IF new_owner IS NULL THEN
            -- find oldest member
            SELECT user_id INTO new_owner FROM public.group_members 
            WHERE group_id = g.id AND user_id != OLD.id 
            ORDER BY joined_at ASC LIMIT 1;
        END IF;

        IF new_owner IS NOT NULL THEN
            UPDATE public.groups SET owner_id = new_owner WHERE id = g.id;
            UPDATE public.group_members SET role = 'owner' WHERE group_id = g.id AND user_id = new_owner;
        ELSE
            DELETE FROM public.groups WHERE id = g.id;
        END IF;
    END LOOP;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_transfer_groups_on_profile_delete ON public.profiles;
CREATE TRIGGER tr_transfer_groups_on_profile_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.transfer_groups_on_profile_delete();

-- 2. Cleanup media from storage automatically when a post or message is deleted
CREATE OR REPLACE FUNCTION public.cleanup_media_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.media_path IS NOT NULL AND OLD.media_path != '' THEN
    DELETE FROM storage.objects WHERE bucket_id = 'media' AND name = OLD.media_path;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_cleanup_media_posts ON public.posts;
CREATE TRIGGER tr_cleanup_media_posts AFTER DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.cleanup_media_on_delete();

DROP TRIGGER IF EXISTS tr_cleanup_media_messages ON public.messages;
CREATE TRIGGER tr_cleanup_media_messages AFTER DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.cleanup_media_on_delete();

DROP TRIGGER IF EXISTS tr_cleanup_media_group_messages ON public.group_messages;
CREATE TRIGGER tr_cleanup_media_group_messages AFTER DELETE ON public.group_messages FOR EACH ROW EXECUTE FUNCTION public.cleanup_media_on_delete();

DROP TRIGGER IF EXISTS tr_cleanup_media_stories ON public.stories;
CREATE TRIGGER tr_cleanup_media_stories AFTER DELETE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.cleanup_media_on_delete();

-- 3. Strict Privacy: Admins can no longer read direct messages and private group messages
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id));

DROP POLICY IF EXISTS "gmsg_select" ON public.group_messages;
CREATE POLICY "gmsg_select" ON public.group_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));
