-- Tighten all rate limits for a small community (50-60 users)

-- 1. General Rate Limits (Posts, Comments, Messages)
CREATE OR REPLACE FUNCTION public.check_rate_limit()
RETURNS TRIGGER AS $$
DECLARE recent_count INT;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;

  IF TG_TABLE_NAME = 'posts' THEN
    SELECT count(*) INTO recent_count FROM public.posts WHERE user_id = auth.uid() AND created_at > now() - interval '1 minute';
    IF recent_count >= 3 THEN RAISE EXCEPTION 'Juda ko''p post yukladingiz. 1 daqiqa kuting.'; END IF;
  ELSIF TG_TABLE_NAME = 'comments' THEN
    SELECT count(*) INTO recent_count FROM public.comments WHERE user_id = auth.uid() AND created_at > now() - interval '1 minute';
    IF recent_count >= 10 THEN RAISE EXCEPTION 'Juda ko''p izoh qoldirdingiz. 1 daqiqa kuting.'; END IF;
  ELSIF TG_TABLE_NAME = 'messages' THEN
    SELECT count(*) INTO recent_count FROM public.messages WHERE sender_id = auth.uid() AND created_at > now() - interval '1 minute';
    IF recent_count >= 15 THEN RAISE EXCEPTION 'Juda ko''p xabar yubordingiz. 1 daqiqa kuting.'; END IF;
  ELSIF TG_TABLE_NAME = 'group_messages' THEN
    SELECT count(*) INTO recent_count FROM public.group_messages WHERE sender_id = auth.uid() AND created_at > now() - interval '1 minute';
    IF recent_count >= 15 THEN RAISE EXCEPTION 'Guruhga juda ko''p xabar yubordingiz. 1 daqiqa kuting.'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Calls Limit
CREATE OR REPLACE FUNCTION public.check_rate_limit_calls()
RETURNS TRIGGER AS $$
DECLARE recent_count INT;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent_count FROM public.calls WHERE caller_id = auth.uid() AND created_at > now() - interval '1 minute';
  IF recent_count >= 5 THEN RAISE EXCEPTION 'Juda ko''p qo''ng''iroq qildingiz. 1 daqiqa kuting.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Email Lookup Limit
CREATE OR REPLACE FUNCTION public.email_for_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_ip text; v_lookups int; v_email text;
BEGIN
    v_ip := coalesce(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), 'unknown');
    IF random() < 0.01 THEN DELETE FROM public.anon_rate_limits WHERE last_lookup < now() - interval '1 hour'; END IF;

    SELECT lookups INTO v_lookups FROM public.anon_rate_limits WHERE ip = v_ip;
    IF v_lookups IS NOT NULL THEN
        IF v_lookups >= 3 THEN
            IF (SELECT last_lookup FROM public.anon_rate_limits WHERE ip = v_ip) > now() - interval '15 minutes' THEN
                RAISE EXCEPTION 'Urunishlar soni oshib ketdi. 15 daqiqa kuting.';
            ELSE
                UPDATE public.anon_rate_limits SET lookups = 1, last_lookup = now() WHERE ip = v_ip;
            END IF;
        ELSE
            UPDATE public.anon_rate_limits SET lookups = lookups + 1, last_lookup = now() WHERE ip = v_ip;
        END IF;
    ELSE
        INSERT INTO public.anon_rate_limits (ip) VALUES (v_ip) ON CONFLICT (ip) DO UPDATE SET lookups = 1, last_lookup = now();
    END IF;

    SELECT email INTO v_email FROM public.profiles WHERE username = lower(p_username);
    RETURN v_email;
END;
$$;

-- 4. Errors Limit
CREATE OR REPLACE FUNCTION public.check_rate_limit_errors()
RETURNS TRIGGER AS $$
DECLARE recent_count INT;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent_count FROM public.client_errors 
  WHERE (user_id = auth.uid() OR ip = current_setting('request.headers', true)::json->>'x-forwarded-for') 
    AND created_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN RAISE EXCEPTION 'Too many errors logged.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Storage Limit
CREATE OR REPLACE FUNCTION public.check_storage_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INT; recent_size BIGINT; new_size BIGINT;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Ruxsatsiz fayl yuklash taqiqlangan'; END IF;

  new_size := coalesce((NEW.metadata->>'size')::bigint, 0);
  IF new_size > 52428800 THEN RAISE EXCEPTION 'Fayl juda katta. Maksimal hajm 50MB.'; END IF;

  SELECT count(*), coalesce(sum((metadata->>'size')::bigint), 0) INTO recent_count, recent_size
  FROM storage.objects WHERE owner = auth.uid() AND created_at > now() - interval '1 minute';

  IF recent_count >= 5 THEN RAISE EXCEPTION 'Juda ko''p fayl yukladingiz. 1 daqiqa kuting.'; END IF;
  IF (recent_size + new_size) > 52428800 THEN RAISE EXCEPTION 'Trafik limiti tugadi (Max 50MB/min). 1 daqiqa kuting.'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Group Members Limit
CREATE OR REPLACE FUNCTION public.check_group_members_rate_limit()
RETURNS TRIGGER AS $$
DECLARE recent_count INT;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent_count FROM public.group_members 
  WHERE group_id = NEW.group_id AND joined_at > now() - interval '1 minute';
  IF recent_count >= 10 THEN RAISE EXCEPTION 'Guruhga birdaniga ko''p a''zo qo''shilmoqda. 1 daqiqa kuting.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Chats Creation Limit
CREATE OR REPLACE FUNCTION public.check_chats_rate_limit()
RETURNS TRIGGER AS $$
DECLARE recent_count INT;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent_count FROM public.chats 
  WHERE (user_a = auth.uid() OR user_b = auth.uid()) AND created_at > now() - interval '1 minute';
  IF recent_count >= 3 THEN RAISE EXCEPTION 'Juda ko''p suhbat ochdingiz. 1 daqiqa kuting.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Groups Creation Limit
CREATE OR REPLACE FUNCTION public.check_groups_rate_limit()
RETURNS TRIGGER AS $$
DECLARE recent_count INT;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent_count FROM public.groups 
  WHERE owner_id = auth.uid() AND created_at > now() - interval '1 hour';
  IF recent_count >= 3 THEN RAISE EXCEPTION 'Juda ko''p guruh yaratdingiz. 1 soat kuting.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Likes Limit
CREATE OR REPLACE FUNCTION public.check_likes_rate_limit()
RETURNS TRIGGER AS $$
DECLARE recent_count INT;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent_count FROM public.post_likes 
  WHERE user_id = auth.uid() AND created_at > now() - interval '1 minute';
  IF recent_count >= 30 THEN RAISE EXCEPTION 'Juda ko''p reaksiya bildirdingiz. 1 daqiqa kuting.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
