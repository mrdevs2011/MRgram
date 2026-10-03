-- Add rate limiting to email_for_username to prevent email enumeration / data leaks
CREATE TABLE IF NOT EXISTS public.anon_rate_limits (
    ip text PRIMARY KEY,
    lookups int DEFAULT 1,
    last_lookup timestamp with time zone DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.email_for_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_ip text;
    v_lookups int;
    v_email text;
BEGIN
    -- Extract IP if possible (PostgREST sets x-forwarded-for or we can fallback)
    v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
    IF v_ip IS NULL THEN
        v_ip := 'unknown';
    ELSE
        -- Get the first IP in the list
        v_ip := split_part(v_ip, ',', 1);
    END IF;

    -- Clean up old rate limits randomly (1% chance) to keep table small
    IF random() < 0.01 THEN
        DELETE FROM public.anon_rate_limits WHERE last_lookup < now() - interval '1 hour';
    END IF;

    -- Check rate limit
    SELECT lookups INTO v_lookups FROM public.anon_rate_limits WHERE ip = v_ip;
    
    IF v_lookups IS NOT NULL THEN
        IF v_lookups >= 5 THEN
            -- Check if it has been 15 minutes
            IF (SELECT last_lookup FROM public.anon_rate_limits WHERE ip = v_ip) > now() - interval '15 minutes' THEN
                RAISE EXCEPTION 'Too many login attempts. Please wait 15 minutes.';
            ELSE
                -- Reset
                UPDATE public.anon_rate_limits SET lookups = 1, last_lookup = now() WHERE ip = v_ip;
            END IF;
        ELSE
            UPDATE public.anon_rate_limits SET lookups = lookups + 1, last_lookup = now() WHERE ip = v_ip;
        END IF;
    ELSE
        INSERT INTO public.anon_rate_limits (ip) VALUES (v_ip) ON CONFLICT (ip) DO UPDATE SET lookups = 1, last_lookup = now();
    END IF;

    -- Perform the actual lookup
    SELECT email INTO v_email FROM public.profiles WHERE username = lower(p_username);
    RETURN v_email;
END;
$$;

GRANT ALL ON FUNCTION public.email_for_username(text) TO anon;
GRANT ALL ON FUNCTION public.email_for_username(text) TO authenticated;
GRANT ALL ON FUNCTION public.email_for_username(text) TO service_role;
