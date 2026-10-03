CREATE OR REPLACE FUNCTION public.check_groups_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count FROM public.groups 
  WHERE owner_id = auth.uid() 
    AND created_at > now() - interval '1 hour';
    
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Too many groups created recently. Wait 1 hour.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_rate_limit_groups ON public.groups;
CREATE TRIGGER tr_rate_limit_groups BEFORE INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION public.check_groups_rate_limit();
