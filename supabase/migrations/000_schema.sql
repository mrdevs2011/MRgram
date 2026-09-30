-- 000_schema.sql -- JONLI bazadan olingan baseline (supabase db dump, schema-only, 2026-09-30).
-- Sir: send_push_on_* triggerlaridagi x-webhook-secret qiymati __WEBHOOK_SECRET__ bilan almashtirilgan (repoga yozilmaydi).
-- Yangi bazada ishga tushirishdan oldin o'sha joyga haqiqiy qiymatni qo'ying.
-- Eslatma: bu dump 001-006, 014, 015 ni o'z ichiga oladi (ularni qayta yurgizish shart emas).




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."admin_delete_user"("p_uid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'Faqat admin';
  end if;
  if p_uid = auth.uid() then
    raise exception 'O''zingizni bu yerdan o''chirib bo''lmaydi';
  end if;
  delete from auth.users where id = p_uid;
end $$;


ALTER FUNCTION "public"."admin_delete_user"("p_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_storage_usage"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'storage'
    AS $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return coalesce((
    select sum((metadata->>'size')::bigint)
    from storage.objects
    where bucket_id = 'media'
  ), 0);
end;
$$;


ALTER FUNCTION "public"."admin_storage_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_call_candidate"("p_call" "uuid", "p_candidate" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.calls set
    caller_candidates = case when caller_id = auth.uid() then caller_candidates || jsonb_build_array(p_candidate) else caller_candidates end,
    callee_candidates = case when callee_id = auth.uid() then callee_candidates || jsonb_build_array(p_candidate) else callee_candidates end
  where id = p_call and auth.uid() in (caller_id, callee_id);
end $$;


ALTER FUNCTION "public"."append_call_candidate"("p_call" "uuid", "p_candidate" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_post_counters"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_table_name = 'post_likes' then
    update public.posts set likes_count = greatest(likes_count + case when tg_op = 'INSERT' then 1 else -1 end, 0)
    where id = coalesce(new.post_id, old.post_id);
  else
    update public.posts set comment_count = greatest(comment_count + case when tg_op = 'INSERT' then 1 else -1 end, 0)
    where id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end $$;


ALTER FUNCTION "public"."bump_post_counters"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_post_in_group"("p_group" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.groups g
    join public.group_members m on m.group_id = g.id and m.user_id = auth.uid()
    where g.id = p_group
      and (
        m.role in ('owner','admin')
        or (g.type = 'group' and g.msg_permission = 'all')
      )
  );
$$;


ALTER FUNCTION "public"."can_post_in_group"("p_group" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_my_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Tizimga kirilmagan';
  end if;
  delete from auth.users where id = auth.uid();
end $$;


ALTER FUNCTION "public"."delete_my_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."email_for_username"("p_username" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select email from public.profiles where username = lower(p_username);
$$;


ALTER FUNCTION "public"."email_for_username"("p_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_chat"("p_other" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  me uuid := auth.uid();
  a uuid; b uuid; cid uuid;
begin
  if me is null or not public.is_approved() then raise exception 'Ruxsat yo''q'; end if;
  if p_other = me then raise exception 'O''zingiz bilan chat ochib bo''lmaydi'; end if;
  a := least(me, p_other); b := greatest(me, p_other);
  select id into cid from public.chats where user_a = a and user_b = b;
  if cid is null then
    insert into public.chats (user_a, user_b) values (a, b) returning id into cid;
    insert into public.chat_members (chat_id, user_id) values (cid, a), (cid, b);
  end if;
  return cid;
end $$;


ALTER FUNCTION "public"."get_or_create_chat"("p_other" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."group_is_private"("p_group" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select is_private from public.groups where id = p_group), true);
$$;


ALTER FUNCTION "public"."group_is_private"("p_group" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_call_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.caller_id is distinct from old.caller_id or new.callee_id is distinct from old.callee_id
     or new.type is distinct from old.type or new.offer is distinct from old.offer
     or new.created_at is distinct from old.created_at then
    raise exception 'Qo''ng''iroq asosiy maydonlari o''zgarmaydi';
  end if;
  if auth.uid() = old.caller_id and (new.answer is distinct from old.answer
     or new.callee_candidates is distinct from old.callee_candidates) then
    raise exception 'Chaqiruvchi callee maydonlariga tega olmaydi';
  end if;
  if auth.uid() = old.callee_id and new.caller_candidates is distinct from old.caller_candidates then
    raise exception 'Qabul qiluvchi caller maydonlariga tega olmaydi';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."guard_call_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_member_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is not null and new.role is distinct from old.role
     and not (public.is_group_admin(old.group_id) or public.is_admin()) then
    raise exception 'Rolni faqat admin o''zgartira oladi';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."guard_member_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_message_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then return new; end if;
  if auth.uid() = old.sender_id then
    if new.chat_id is distinct from old.chat_id or new.sender_id is distinct from old.sender_id
       or new.type is distinct from old.type or new.media_path is distinct from old.media_path
       or new.created_at is distinct from old.created_at then
      raise exception 'Faqat matn/holatni o''zgartirish mumkin';
    end if;
  else
    if new.text is distinct from old.text or new.edited_at is distinct from old.edited_at
       or new.chat_id is distinct from old.chat_id or new.sender_id is distinct from old.sender_id
       or new.type is distinct from old.type or new.media_path is distinct from old.media_path
       or new.created_at is distinct from old.created_at then
      raise exception 'Qabul qiluvchi faqat o''qilgan deb belgilay oladi';
    end if;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."guard_message_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_profile_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.approval is distinct from old.approval
       or new.blocked is distinct from old.blocked
       or new.blocked_until is distinct from old.blocked_until
       or new.is_admin is distinct from old.is_admin
       or new.created_at is distinct from old.created_at then
      raise exception 'Bu maydonlarni faqat admin o''zgartira oladi';
    end if;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."guard_profile_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uname text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
begin
  insert into public.profiles (id, username, full_name, email, avatar)
  values (
    new.id,
    uname,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), uname),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar', '')
  );
  return new;
end $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_post_view"("p_post" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update public.posts set views = views + 1
  where id = p_post and auth.uid() is not null and public.is_approved()
    and (is_public or user_id = auth.uid());
$$;


ALTER FUNCTION "public"."increment_post_view"("p_post" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_approved"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.approval = 'approved'
      and (not p.blocked or (p.blocked_until is not null and p.blocked_until < now()))
  );
$$;


ALTER FUNCTION "public"."is_approved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_chat_member"("p_chat" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.chats c
                 where c.id = p_chat and auth.uid() in (c.user_a, c.user_b));
$$;


ALTER FUNCTION "public"."is_chat_member"("p_chat" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_admin"("p_group" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid() and role in ('owner','admin'));
$$;


ALTER FUNCTION "public"."is_group_admin"("p_group" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_member"("p_group" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from public.group_members
                 where group_id = p_group and user_id = auth.uid());
$$;


ALTER FUNCTION "public"."is_group_member"("p_group" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_group_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return null;
end $$;


ALTER FUNCTION "public"."on_group_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_group_message_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.groups set
    last_message    = case new.type when 'file' then coalesce(new.file_name, 'Fayl') else coalesce(new.text, '') end,
    last_sender_id  = new.sender_id,
    last_message_at = new.created_at
  where id = new.group_id;
  update public.group_members set unread_count = unread_count + 1
  where group_id = new.group_id and user_id <> new.sender_id;
  return null;
end $$;


ALTER FUNCTION "public"."on_group_message_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_message_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.chats set
    last_message    = case new.type when 'voice' then 'Ovozli xabar'
                                    when 'file'  then coalesce(new.file_name, 'Fayl')
                                    else coalesce(new.text, '') end,
    last_sender_id  = new.sender_id,
    last_message_at = new.created_at
  where id = new.chat_id;
  update public.chat_members set unread_count = unread_count + 1
  where chat_id = new.chat_id and user_id <> new.sender_id;
  return null;
end $$;


ALTER FUNCTION "public"."on_message_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_is_visible"("p_post" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.is_admin() or exists (
    select 1 from public.posts
    where id = p_post and (is_public or user_id = auth.uid())
  );
$$;


ALTER FUNCTION "public"."post_is_visible"("p_post" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_push_token"("p_token" "text", "p_platform" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then raise exception 'Tizimga kirilmagan'; end if;
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform;
end $$;


ALTER FUNCTION "public"."register_push_token"("p_token" "text", "p_platform" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."server_now"() RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE
    AS $$ select now(); $$;


ALTER FUNCTION "public"."server_now"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."username_available"("p_username" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select not exists (select 1 from public.profiles where username = lower(p_username));
$$;


ALTER FUNCTION "public"."username_available"("p_username" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_notice" (
    "id" "text" DEFAULT 'global'::"text" NOT NULL,
    "text" "text" NOT NULL,
    "target" "text" DEFAULT 'all'::"text" NOT NULL,
    "admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_notice_id_check" CHECK (("id" = 'global'::"text"))
);


ALTER TABLE "public"."admin_notice" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "caller_id" "uuid" NOT NULL,
    "callee_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'ringing'::"text" NOT NULL,
    "offer" "jsonb" NOT NULL,
    "answer" "jsonb",
    "caller_candidates" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "callee_candidates" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "video_offer" "jsonb",
    "video_answer" "jsonb",
    CONSTRAINT "calls_type_check" CHECK (("type" = ANY (ARRAY['voice'::"text", 'video'::"text"])))
);

ALTER TABLE ONLY "public"."calls" REPLICA IDENTITY FULL;


ALTER TABLE "public"."calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_members" (
    "chat_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "unread_count" integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY "public"."chat_members" REPLICA IDENTITY FULL;


ALTER TABLE "public"."chat_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_a" "uuid" NOT NULL,
    "user_b" "uuid" NOT NULL,
    "last_message" "text" DEFAULT ''::"text" NOT NULL,
    "last_sender_id" "uuid",
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chats_check" CHECK (("user_a" < "user_b"))
);


ALTER TABLE "public"."chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_errors" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "message" "text" NOT NULL,
    "source" "text",
    "stack" "text",
    "ua" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_errors" OWNER TO "postgres";


ALTER TABLE "public"."client_errors" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."client_errors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_name" "text" DEFAULT ''::"text" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."comments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "owner_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "avatar" "text" DEFAULT ''::"text" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "unread_count" integer DEFAULT 0 NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);

ALTER TABLE ONLY "public"."group_members" REPLICA IDENTITY FULL;


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "text" "text",
    "media_path" "text",
    "media_type" "text",
    "file_name" "text",
    "file_size" bigint,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'file'::"text"])))
);

ALTER TABLE ONLY "public"."group_messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."group_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "avatar" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    "invite_code" "text",
    "msg_permission" "text" DEFAULT 'all'::"text" NOT NULL,
    "last_message" "text" DEFAULT ''::"text" NOT NULL,
    "last_sender_id" "uuid",
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "groups_msg_permission_check" CHECK (("msg_permission" = ANY (ARRAY['all'::"text", 'admins'::"text"]))),
    CONSTRAINT "groups_type_check" CHECK (("type" = ANY (ARRAY['group'::"text", 'channel'::"text"])))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'text'::"text" NOT NULL,
    "text" "text",
    "media_path" "text",
    "media_type" "text",
    "file_name" "text",
    "file_size" bigint,
    "duration" integer,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "read_at" timestamp with time zone,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'delivered'::"text", 'read'::"text"]))),
    CONSTRAINT "messages_type_check" CHECK (("type" = ANY (ARRAY['text'::"text", 'voice'::"text", 'file'::"text"])))
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."post_likes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_full_name" "text" DEFAULT ''::"text" NOT NULL,
    "text" "text",
    "media_path" "text",
    "media_type" "text",
    "media_width" integer,
    "media_height" integer,
    "file_name" "text",
    "file_size" bigint,
    "is_public" boolean DEFAULT false NOT NULL,
    "is_max_private" boolean DEFAULT false NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "likes_count" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text",
    "bio" "text" DEFAULT ''::"text" NOT NULL,
    "avatar" "text" DEFAULT ''::"text" NOT NULL,
    "cover_url" "text",
    "website" "text",
    "location" "text",
    "approval" "text" DEFAULT 'pending'::"text" NOT NULL,
    "blocked" boolean DEFAULT false NOT NULL,
    "blocked_until" timestamp with time zone,
    "is_admin" boolean DEFAULT false NOT NULL,
    "last_seen" timestamp with time zone,
    "last_login" timestamp with time zone,
    "last_user_agent" "text",
    "last_platform" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_approval_check" CHECK (("approval" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "profiles_username_check" CHECK ((("username" = "lower"("username")) AND (("length"("username") >= 2) AND ("length"("username") <= 40))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "token" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "media_path" "text" NOT NULL,
    "media_type" "text" DEFAULT 'image'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval) NOT NULL,
    "caption" "text",
    CONSTRAINT "stories_caption_len" CHECK ((("caption" IS NULL) OR ("char_length"("caption") <= 200)))
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_views" (
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."story_views" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_notice"
    ADD CONSTRAINT "admin_notice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_members"
    ADD CONSTRAINT "chat_members_pkey" PRIMARY KEY ("chat_id", "user_id");



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_user_a_user_b_key" UNIQUE ("user_a", "user_b");



ALTER TABLE ONLY "public"."client_errors"
    ADD CONSTRAINT "client_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("owner_id", "contact_id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("token");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_pkey" PRIMARY KEY ("story_id", "user_id");



CREATE INDEX "calls_callee_idx" ON "public"."calls" USING "btree" ("callee_id", "created_at" DESC);



CREATE INDEX "chat_members_user_idx" ON "public"."chat_members" USING "btree" ("user_id");



CREATE INDEX "comments_post_idx" ON "public"."comments" USING "btree" ("post_id", "created_at");



CREATE INDEX "group_members_user_idx" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "group_messages_idx" ON "public"."group_messages" USING "btree" ("group_id", "created_at");



CREATE INDEX "messages_chat_idx" ON "public"."messages" USING "btree" ("chat_id", "created_at");



CREATE INDEX "posts_created_idx" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "posts_user_idx" ON "public"."posts" USING "btree" ("user_id", "created_at" DESC);



CREATE UNIQUE INDEX "profiles_username_key" ON "public"."profiles" USING "btree" ("username");



CREATE INDEX "push_tokens_user_idx" ON "public"."push_tokens" USING "btree" ("user_id");



CREATE INDEX "stories_expires_idx" ON "public"."stories" USING "btree" ("expires_at" DESC);



CREATE INDEX "stories_user_idx" ON "public"."stories" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "calls_guard" BEFORE UPDATE ON "public"."calls" FOR EACH ROW EXECUTE FUNCTION "public"."guard_call_update"();



CREATE OR REPLACE TRIGGER "comments_count" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."bump_post_counters"();



CREATE OR REPLACE TRIGGER "group_members_guard" BEFORE UPDATE ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."guard_member_update"();



CREATE OR REPLACE TRIGGER "group_messages_after_insert" AFTER INSERT ON "public"."group_messages" FOR EACH ROW EXECUTE FUNCTION "public"."on_group_message_insert"();



CREATE OR REPLACE TRIGGER "groups_after_insert" AFTER INSERT ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."on_group_insert"();



CREATE OR REPLACE TRIGGER "messages_after_insert" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."on_message_insert"();



CREATE OR REPLACE TRIGGER "messages_guard" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."guard_message_update"();



CREATE OR REPLACE TRIGGER "post_likes_count" AFTER INSERT OR DELETE ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."bump_post_counters"();



CREATE OR REPLACE TRIGGER "profiles_guard" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_profile_update"();



CREATE OR REPLACE TRIGGER "send_push_on_calls" AFTER INSERT ON "public"."calls" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://dsomjkskgrhaaxpkdyvs.supabase.co/functions/v1/send-push', 'POST', '{"Content-Type":"application/json","x-webhook-secret":"__WEBHOOK_SECRET__"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "send_push_on_group_messages" AFTER INSERT ON "public"."group_messages" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://dsomjkskgrhaaxpkdyvs.supabase.co/functions/v1/send-push', 'POST', '{"Content-Type":"application/json","x-webhook-secret":"__WEBHOOK_SECRET__"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "send_push_on_messages" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://dsomjkskgrhaaxpkdyvs.supabase.co/functions/v1/send-push', 'POST', '{"Content-Type":"application/json","x-webhook-secret":"__WEBHOOK_SECRET__"}', '{}', '5000');



ALTER TABLE ONLY "public"."admin_notice"
    ADD CONSTRAINT "admin_notice_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_callee_id_fkey" FOREIGN KEY ("callee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_members"
    ADD CONSTRAINT "chat_members_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_members"
    ADD CONSTRAINT "chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_user_a_fkey" FOREIGN KEY ("user_a") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_user_b_fkey" FOREIGN KEY ("user_b") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_errors"
    ADD CONSTRAINT "client_errors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_messages"
    ADD CONSTRAINT "group_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_views"
    ADD CONSTRAINT "story_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."admin_notice" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calls_delete" ON "public"."calls" FOR DELETE TO "authenticated" USING (((("auth"."uid"() = "caller_id") OR ("auth"."uid"() = "callee_id")) OR "public"."is_admin"()));



CREATE POLICY "calls_insert" ON "public"."calls" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR (("caller_id" = "auth"."uid"()) AND "public"."is_approved"())));



CREATE POLICY "calls_select" ON "public"."calls" FOR SELECT TO "authenticated" USING (((("auth"."uid"() = "caller_id") OR ("auth"."uid"() = "callee_id")) OR "public"."is_admin"()));



CREATE POLICY "calls_update" ON "public"."calls" FOR UPDATE TO "authenticated" USING (((("auth"."uid"() = "caller_id") OR ("auth"."uid"() = "callee_id")) OR "public"."is_admin"()));



ALTER TABLE "public"."chat_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_members_select" ON "public"."chat_members" FOR SELECT TO "authenticated" USING (("public"."is_chat_member"("chat_id") OR "public"."is_admin"()));



CREATE POLICY "chat_members_update" ON "public"."chat_members" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chats_delete" ON "public"."chats" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "chats_select" ON "public"."chats" FOR SELECT TO "authenticated" USING (((("auth"."uid"() = "user_a") OR ("auth"."uid"() = "user_b")) OR "public"."is_admin"()));



ALTER TABLE "public"."client_errors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_errors_admin_delete" ON "public"."client_errors" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "client_errors_admin_read" ON "public"."client_errors" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "client_errors_insert" ON "public"."client_errors" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_delete" ON "public"."comments" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "comments_insert" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_approved"() AND "public"."post_is_visible"("post_id")));



CREATE POLICY "comments_select" ON "public"."comments" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("public"."is_approved"() AND "public"."post_is_visible"("post_id"))));



CREATE POLICY "comments_update" ON "public"."comments" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contacts_all" ON "public"."contacts" TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK ((("owner_id" = "auth"."uid"()) AND "public"."is_approved"()));



CREATE POLICY "gm_delete" ON "public"."group_members" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_group_admin"("group_id") OR "public"."is_admin"()));



CREATE POLICY "gm_insert" ON "public"."group_members" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR "public"."is_group_admin"("group_id") OR (("user_id" = "auth"."uid"()) AND ("role" = 'member'::"text") AND "public"."is_approved"() AND (NOT "public"."group_is_private"("group_id")))));



CREATE POLICY "gm_select" ON "public"."group_members" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR "public"."is_group_member"("group_id") OR (NOT "public"."group_is_private"("group_id"))));



CREATE POLICY "gm_update" ON "public"."group_members" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_group_admin"("group_id") OR "public"."is_admin"()));



CREATE POLICY "gmsg_delete" ON "public"."group_messages" FOR DELETE TO "authenticated" USING ((("sender_id" = "auth"."uid"()) OR "public"."is_group_admin"("group_id") OR "public"."is_admin"()));



CREATE POLICY "gmsg_insert" ON "public"."group_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND "public"."is_approved"() AND ("public"."can_post_in_group"("group_id") OR "public"."is_admin"())));



CREATE POLICY "gmsg_select" ON "public"."group_messages" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR "public"."is_group_member"("group_id")));



CREATE POLICY "gmsg_update" ON "public"."group_messages" FOR UPDATE TO "authenticated" USING (("sender_id" = "auth"."uid"())) WITH CHECK (("sender_id" = "auth"."uid"()));



ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_delete" ON "public"."groups" FOR DELETE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "groups_insert" ON "public"."groups" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR ("public"."is_approved"() AND ("owner_id" = "auth"."uid"()))));



CREATE POLICY "groups_select" ON "public"."groups" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR (NOT "is_private") OR "public"."is_group_member"("id")));



CREATE POLICY "groups_update" ON "public"."groups" FOR UPDATE TO "authenticated" USING (("public"."is_group_admin"("id") OR "public"."is_admin"())) WITH CHECK (("public"."is_group_admin"("id") OR "public"."is_admin"()));



CREATE POLICY "likes_delete" ON "public"."post_likes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "likes_insert" ON "public"."post_likes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."is_approved"() AND "public"."post_is_visible"("post_id")));



CREATE POLICY "likes_select" ON "public"."post_likes" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("public"."is_approved"() AND "public"."post_is_visible"("post_id"))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_delete" ON "public"."messages" FOR DELETE TO "authenticated" USING ((("sender_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "messages_insert" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND "public"."is_approved"() AND "public"."is_chat_member"("chat_id")));



CREATE POLICY "messages_select" ON "public"."messages" FOR SELECT TO "authenticated" USING (("public"."is_chat_member"("chat_id") OR "public"."is_admin"()));



CREATE POLICY "messages_update" ON "public"."messages" FOR UPDATE TO "authenticated" USING ("public"."is_chat_member"("chat_id")) WITH CHECK ("public"."is_chat_member"("chat_id"));



CREATE POLICY "notice_select" ON "public"."admin_notice" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "notice_write" ON "public"."admin_notice" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "posts_delete" ON "public"."posts" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "posts_insert" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR ("public"."is_approved"() AND ("user_id" = "auth"."uid"()) AND ("views" = 0) AND ("likes_count" = 0) AND ("comment_count" = 0))));



CREATE POLICY "posts_select" ON "public"."posts" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("user_id" = "auth"."uid"()) OR "is_public"));



CREATE POLICY "posts_update" ON "public"."posts" FOR UPDATE TO "authenticated" USING ((("public"."is_approved"() AND ("user_id" = "auth"."uid"())) OR "public"."is_admin"())) WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete" ON "public"."profiles" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_approved"() OR "public"."is_admin"()));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_tokens_admin_select" ON "public"."push_tokens" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "push_tokens_all" ON "public"."push_tokens" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stories_delete" ON "public"."stories" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "stories_insert" ON "public"."stories" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "stories_select" ON "public"."stories" FOR SELECT TO "authenticated" USING (("expires_at" > "now"()));



ALTER TABLE "public"."story_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "story_views_insert" ON "public"."story_views" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "story_views_select" ON "public"."story_views" FOR SELECT TO "authenticated" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."admin_notice";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."calls";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chats";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."group_members";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."group_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."groups";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."post_likes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."admin_delete_user"("p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_delete_user"("p_uid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_storage_usage"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_storage_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."admin_storage_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_storage_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."append_call_candidate"("p_call" "uuid", "p_candidate" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."append_call_candidate"("p_call" "uuid", "p_candidate" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_call_candidate"("p_call" "uuid", "p_candidate" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_post_counters"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_post_counters"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_post_counters"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_post_in_group"("p_group" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_post_in_group"("p_group" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_post_in_group"("p_group" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_my_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_my_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_my_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."email_for_username"("p_username" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."email_for_username"("p_username" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."email_for_username"("p_username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_or_create_chat"("p_other" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_chat"("p_other" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_chat"("p_other" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."group_is_private"("p_group" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."group_is_private"("p_group" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."group_is_private"("p_group" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_call_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_call_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_call_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_member_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_member_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_member_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_message_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_message_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_message_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_profile_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_profile_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_profile_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_post_view"("p_post" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_post_view"("p_post" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_post_view"("p_post" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_approved"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_approved"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_approved"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_chat_member"("p_chat" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_chat_member"("p_chat" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_chat_member"("p_chat" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_admin"("p_group" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_admin"("p_group" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_admin"("p_group" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_group_member"("p_group" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."on_group_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_group_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_group_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_group_message_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_group_message_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_group_message_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_message_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_message_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_message_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."post_is_visible"("p_post" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."post_is_visible"("p_post" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_is_visible"("p_post" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_push_token"("p_token" "text", "p_platform" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_push_token"("p_token" "text", "p_platform" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_push_token"("p_token" "text", "p_platform" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."server_now"() TO "anon";
GRANT ALL ON FUNCTION "public"."server_now"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."server_now"() TO "service_role";



GRANT ALL ON FUNCTION "public"."username_available"("p_username" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."username_available"("p_username" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."username_available"("p_username" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."admin_notice" TO "anon";
GRANT ALL ON TABLE "public"."admin_notice" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notice" TO "service_role";



GRANT ALL ON TABLE "public"."calls" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."calls" TO "authenticated";
GRANT ALL ON TABLE "public"."calls" TO "service_role";



GRANT UPDATE("status") ON TABLE "public"."calls" TO "authenticated";



GRANT UPDATE("answer") ON TABLE "public"."calls" TO "authenticated";



GRANT UPDATE("caller_candidates") ON TABLE "public"."calls" TO "authenticated";



GRANT UPDATE("callee_candidates") ON TABLE "public"."calls" TO "authenticated";



GRANT UPDATE("video_offer") ON TABLE "public"."calls" TO "authenticated";



GRANT UPDATE("video_answer") ON TABLE "public"."calls" TO "authenticated";



GRANT ALL ON TABLE "public"."chat_members" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."chat_members" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_members" TO "service_role";



GRANT UPDATE("unread_count") ON TABLE "public"."chat_members" TO "authenticated";



GRANT ALL ON TABLE "public"."chats" TO "anon";
GRANT ALL ON TABLE "public"."chats" TO "authenticated";
GRANT ALL ON TABLE "public"."chats" TO "service_role";



GRANT ALL ON TABLE "public"."client_errors" TO "anon";
GRANT ALL ON TABLE "public"."client_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."client_errors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."client_errors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."client_errors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."client_errors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT UPDATE("text") ON TABLE "public"."comments" TO "authenticated";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT UPDATE("role") ON TABLE "public"."group_members" TO "authenticated";



GRANT UPDATE("unread_count") ON TABLE "public"."group_members" TO "authenticated";



GRANT ALL ON TABLE "public"."group_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."group_messages" TO "service_role";



GRANT UPDATE("text") ON TABLE "public"."group_messages" TO "authenticated";



GRANT UPDATE("edited_at") ON TABLE "public"."group_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT UPDATE("name") ON TABLE "public"."groups" TO "authenticated";



GRANT UPDATE("avatar") ON TABLE "public"."groups" TO "authenticated";



GRANT UPDATE("description") ON TABLE "public"."groups" TO "authenticated";



GRANT UPDATE("is_private") ON TABLE "public"."groups" TO "authenticated";



GRANT UPDATE("invite_code") ON TABLE "public"."groups" TO "authenticated";



GRANT UPDATE("msg_permission") ON TABLE "public"."groups" TO "authenticated";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT UPDATE("text") ON TABLE "public"."messages" TO "authenticated";



GRANT UPDATE("status") ON TABLE "public"."messages" TO "authenticated";



GRANT UPDATE("read_at") ON TABLE "public"."messages" TO "authenticated";



GRANT UPDATE("edited_at") ON TABLE "public"."messages" TO "authenticated";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT UPDATE("text") ON TABLE "public"."posts" TO "authenticated";



GRANT UPDATE("is_public") ON TABLE "public"."posts" TO "authenticated";



GRANT UPDATE("is_max_private") ON TABLE "public"."posts" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT ALL ON TABLE "public"."story_views" TO "anon";
GRANT ALL ON TABLE "public"."story_views" TO "authenticated";
GRANT ALL ON TABLE "public"."story_views" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































