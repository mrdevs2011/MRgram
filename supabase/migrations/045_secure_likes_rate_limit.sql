CREATE OR REPLACE FUNCTION public.check_likes_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count FROM public.post_likes 
  WHERE user_id = auth.uid() 
    AND created_at > now() - interval '1 minute';
    
  IF recent_count >= 60 THEN
    RAISE EXCEPTION 'Too many likes recently. Wait 1 minute.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_rate_limit_likes ON public.post_likes;
CREATE TRIGGER tr_rate_limit_likes BEFORE INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.check_likes_rate_limit();
