CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
SELECT cron.schedule('cleanup-expired-stories', '0 3 * * *', $$
  DELETE FROM public.stories WHERE expires_at < now();
$$);
