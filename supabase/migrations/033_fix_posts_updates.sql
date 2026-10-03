-- Prevent users from modifying stats on their own posts directly
CREATE OR REPLACE FUNCTION public.check_posts_update_security()
RETURNS TRIGGER AS $$
BEGIN
  -- If the update is triggered by a SECURITY DEFINER function (like bump_post_counters),
  -- current_user will be postgres. We allow postgres to bypass this check.
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    -- Prevent manually setting likes, comments, views
    IF NEW.views IS DISTINCT FROM OLD.views THEN
       IF NEW.views != OLD.views + 1 THEN
         RAISE EXCEPTION 'Security violation: Cannot artificially modify views';
       END IF;
    END IF;
    
    IF NEW.likes_count IS DISTINCT FROM OLD.likes_count THEN
       RAISE EXCEPTION 'Security violation: Cannot modify likes_count manually (use RPC or like trigger)';
    END IF;
    
    IF NEW.comment_count IS DISTINCT FROM OLD.comment_count THEN
       RAISE EXCEPTION 'Security violation: Cannot modify comment_count manually';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_posts_update_security ON public.posts;
CREATE TRIGGER tr_check_posts_update_security
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_posts_update_security();
