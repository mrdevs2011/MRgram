CREATE OR REPLACE FUNCTION public.check_group_members_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- A user can only invite/add members to groups they admin, or join a public group themselves
  -- Let's limit the number of group_members rows they can insert in a minute.
  -- Since auth.uid() is the one executing the INSERT, we check how many inserts THEY did recently.
  -- But we don't have a created_by field in group_members. 
  -- However, we can check how many rows were added to the specific group_id in the last minute.
  SELECT count(*) INTO recent_count FROM public.group_members 
  WHERE group_id = NEW.group_id 
    AND joined_at > now() - interval '1 minute';
    
  IF recent_count >= 50 THEN
    RAISE EXCEPTION 'Too many members added to this group recently. Wait 1 minute.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_rate_limit_group_members ON public.group_members;
CREATE TRIGGER tr_rate_limit_group_members BEFORE INSERT ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.check_group_members_rate_limit();
