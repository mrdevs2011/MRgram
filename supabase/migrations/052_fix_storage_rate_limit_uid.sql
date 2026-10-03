CREATE OR REPLACE FUNCTION public.check_storage_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  recent_count INT; recent_size BIGINT; new_size BIGINT; v_uid uuid; v_admin boolean;
BEGIN
  -- storage-api ba'zan INSERT'ni JWT'siz (superuser) bajaradi: auth.uid() NULL bo'ladi,
  -- egasi esa NEW.owner / NEW.owner_id da (storage JWT'dan oladi).
  v_uid := coalesce(auth.uid(), NEW.owner, nullif(NEW.owner_id, '')::uuid);
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Ruxsatsiz fayl yuklash taqiqlangan'; END IF;

  SELECT coalesce(is_admin, false) INTO v_admin FROM public.profiles WHERE id = v_uid;
  IF coalesce(v_admin, false) THEN RETURN NEW; END IF;

  new_size := coalesce((NEW.metadata->>'size')::bigint, 0);
  IF new_size > 52428800 THEN RAISE EXCEPTION 'Fayl juda katta. Maksimal hajm 50MB.'; END IF;

  SELECT count(*), coalesce(sum((metadata->>'size')::bigint), 0) INTO recent_count, recent_size
  FROM storage.objects WHERE owner = v_uid AND created_at > now() - interval '1 minute';

  IF recent_count >= 5 THEN RAISE EXCEPTION 'Juda ko''p fayl yukladingiz. 1 daqiqa kuting.'; END IF;
  IF (recent_size + new_size) > 52428800 THEN RAISE EXCEPTION 'Trafik limiti tugadi (Max 50MB/min). 1 daqiqa kuting.'; END IF;

  RETURN NEW;
END;
$function$;
