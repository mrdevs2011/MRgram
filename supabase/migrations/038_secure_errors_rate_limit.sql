CREATE OR REPLACE FUNCTION public.check_rate_limit_errors()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count FROM public.client_errors 
  WHERE (user_id = auth.uid() OR ip = current_setting('request.headers', true)::json->>'x-forwarded-for') 
    AND created_at > now() - interval '1 minute';
    
  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Too many errors logged.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_rate_limit_errors ON public.client_errors;
CREATE TRIGGER tr_rate_limit_errors BEFORE INSERT ON public.client_errors FOR EACH ROW EXECUTE FUNCTION public.check_rate_limit_errors();
