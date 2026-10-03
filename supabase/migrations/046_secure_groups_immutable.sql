CREATE OR REPLACE FUNCTION public.check_groups_update_security()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
       RAISE EXCEPTION 'Security violation: Cannot modify created_at';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
       RAISE EXCEPTION 'Security violation: Cannot modify group id';
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
       RAISE EXCEPTION 'Security violation: Cannot transfer ownership directly (use proper RPC if allowed)';
    END IF;
    IF NEW.type IS DISTINCT FROM OLD.type THEN
       RAISE EXCEPTION 'Security violation: Cannot change group type';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_groups_update_security ON public.groups;
CREATE TRIGGER tr_check_groups_update_security
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.check_groups_update_security();
