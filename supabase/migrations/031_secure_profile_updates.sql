-- Prevent users from making themselves admin or unblocking themselves
CREATE OR REPLACE FUNCTION public.check_profile_update_security()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user updating is NOT an admin
  IF NOT public.is_admin() THEN
    -- Prevent changing is_admin
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
       RAISE EXCEPTION 'Security violation: Cannot modify is_admin status';
    END IF;
    -- Prevent changing approval status
    IF NEW.approval IS DISTINCT FROM OLD.approval THEN
       RAISE EXCEPTION 'Security violation: Cannot modify approval status';
    END IF;
    -- Prevent changing blocked status
    IF NEW.blocked IS DISTINCT FROM OLD.blocked THEN
       RAISE EXCEPTION 'Security violation: Cannot modify blocked status';
    END IF;
    IF NEW.blocked_until IS DISTINCT FROM OLD.blocked_until THEN
       RAISE EXCEPTION 'Security violation: Cannot modify blocked_until status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_profile_update_security ON public.profiles;
CREATE TRIGGER tr_check_profile_update_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_update_security();
