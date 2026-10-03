-- Server-side rate limiting to prevent spam and DDoS on the database
CREATE OR REPLACE FUNCTION public.check_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  -- Admin bypasses rate limits
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'posts' THEN
    SELECT count(*) INTO recent_count FROM public.posts 
    WHERE user_id = auth.uid() AND created_at > now() - interval '1 minute';
    IF recent_count >= 5 THEN
      RAISE EXCEPTION 'Too many posts. Please wait a minute.';
    END IF;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    SELECT count(*) INTO recent_count FROM public.comments 
    WHERE user_id = auth.uid() AND created_at > now() - interval '1 minute';
    IF recent_count >= 15 THEN
      RAISE EXCEPTION 'Too many comments. Please wait a minute.';
    END IF;
  ELSIF TG_TABLE_NAME = 'messages' THEN
    SELECT count(*) INTO recent_count FROM public.messages 
    WHERE sender_id = auth.uid() AND created_at > now() - interval '1 minute';
    IF recent_count >= 30 THEN
      RAISE EXCEPTION 'Too many messages. Please wait a minute.';
    END IF;
  ELSIF TG_TABLE_NAME = 'group_messages' THEN
    SELECT count(*) INTO recent_count FROM public.group_messages 
    WHERE sender_id = auth.uid() AND created_at > now() - interval '1 minute';
    IF recent_count >= 30 THEN
      RAISE EXCEPTION 'Too many group messages. Please wait a minute.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_rate_limit_posts ON public.posts;
CREATE TRIGGER tr_rate_limit_posts BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION public.check_rate_limit();

DROP TRIGGER IF EXISTS tr_rate_limit_comments ON public.comments;
CREATE TRIGGER tr_rate_limit_comments BEFORE INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.check_rate_limit();

DROP TRIGGER IF EXISTS tr_rate_limit_messages ON public.messages;
CREATE TRIGGER tr_rate_limit_messages BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.check_rate_limit();

DROP TRIGGER IF EXISTS tr_rate_limit_gmessages ON public.group_messages;
CREATE TRIGGER tr_rate_limit_gmessages BEFORE INSERT ON public.group_messages FOR EACH ROW EXECUTE FUNCTION public.check_rate_limit();
