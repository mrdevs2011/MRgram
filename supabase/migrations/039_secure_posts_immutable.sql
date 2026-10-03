CREATE OR REPLACE FUNCTION public.check_posts_update_security()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    IF NEW.views IS DISTINCT FROM OLD.views THEN
       IF NEW.views != OLD.views + 1 THEN
         RAISE EXCEPTION 'Security violation: Cannot artificially modify views';
       END IF;
    END IF;
    
    IF NEW.likes_count IS DISTINCT FROM OLD.likes_count THEN
       RAISE EXCEPTION 'Security violation: Cannot modify likes_count manually';
    END IF;
    
    IF NEW.comment_count IS DISTINCT FROM OLD.comment_count THEN
       RAISE EXCEPTION 'Security violation: Cannot modify comment_count manually';
    END IF;

    -- Prevent cheating feed order or ownership
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
       RAISE EXCEPTION 'Security violation: Cannot modify created_at (feed cheating)';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
       RAISE EXCEPTION 'Security violation: Cannot transfer ownership';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
       RAISE EXCEPTION 'Security violation: Cannot modify post id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
