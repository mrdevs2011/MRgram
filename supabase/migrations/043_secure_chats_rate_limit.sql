CREATE OR REPLACE FUNCTION public.check_chats_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Limit how many chats a user can initiate in 1 minute
  SELECT count(*) INTO recent_count FROM public.chats 
  WHERE (user_a = auth.uid() OR user_b = auth.uid()) 
    AND created_at > now() - interval '1 minute';
    
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Too many new chats created recently. Wait 1 minute.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_rate_limit_chats ON public.chats;
CREATE TRIGGER tr_rate_limit_chats BEFORE INSERT ON public.chats FOR EACH ROW EXECUTE FUNCTION public.check_chats_rate_limit();
