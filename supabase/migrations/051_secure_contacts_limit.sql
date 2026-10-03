CREATE OR REPLACE FUNCTION public.check_contacts_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  total_count INT;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;

  SELECT count(*) INTO total_count FROM public.contacts 
  WHERE owner_id = auth.uid();
    
  IF total_count >= 5000 THEN
    RAISE EXCEPTION 'Too many contacts. Maximum limit reached.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_limit_contacts ON public.contacts;
CREATE TRIGGER tr_limit_contacts BEFORE INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.check_contacts_rate_limit();
