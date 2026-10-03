CREATE OR REPLACE FUNCTION public.check_rate_limit_calls()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count FROM public.calls 
  WHERE caller_id = auth.uid() AND created_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Too many calls initiated. Please wait a minute.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_rate_limit_calls ON public.calls;
CREATE TRIGGER tr_rate_limit_calls BEFORE INSERT ON public.calls FOR EACH ROW EXECUTE FUNCTION public.check_rate_limit_calls();
