CREATE OR REPLACE FUNCTION public.check_comments_update_security()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    -- Only allow changing text and edited_at
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
       RAISE EXCEPTION 'Security violation: Cannot modify created_at';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
       RAISE EXCEPTION 'Security violation: Cannot transfer ownership';
    END IF;
    IF NEW.post_id IS DISTINCT FROM OLD.post_id THEN
       RAISE EXCEPTION 'Security violation: Cannot move comment to another post';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
       RAISE EXCEPTION 'Security violation: Cannot modify comment id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_comments_update_security ON public.comments;
CREATE TRIGGER tr_check_comments_update_security
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_comments_update_security();
