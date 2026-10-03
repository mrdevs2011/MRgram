CREATE OR REPLACE FUNCTION public.check_storage_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT;
  recent_size BIGINT;
  new_size BIGINT;
BEGIN
  -- Bypass for admins
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Only apply to authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated storage upload not allowed';
  END IF;

  -- Parse new file size
  new_size := (NEW.metadata->>'size')::bigint;
  IF new_size IS NULL THEN
    new_size := 0;
  END IF;

  -- Hard limit: Reject any single file > 50MB (52428800 bytes)
  IF new_size > 52428800 THEN
    RAISE EXCEPTION 'File too large. Maximum allowed size is 50MB.';
  END IF;

  -- Calculate recent uploads in the last 1 minute
  SELECT count(*), coalesce(sum((metadata->>'size')::bigint), 0)
  INTO recent_count, recent_size
  FROM storage.objects
  WHERE owner = auth.uid() 
    AND created_at > now() - interval '1 minute';

  -- Max 10 files per minute
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many file uploads. Wait 1 minute.';
  END IF;

  -- Max 50MB total bandwidth per minute per user (matching client quota)
  IF (recent_size + new_size) > 52428800 THEN
    RAISE EXCEPTION 'Bandwidth quota exceeded: Max 50MB per minute.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_storage_rate_limit ON storage.objects;
CREATE TRIGGER tr_storage_rate_limit
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.check_storage_rate_limit();
