-- Baseline schema, generated from the live Coptic-Hub database (pg_dump) on 2026-07-13.
--
-- The migration files that previously lived here had drifted badly from production:
-- the RLS layer had been rewritten by hand in the Supabase dashboard, so ~20 live
-- policies appeared in no migration, and ~23 policies the files created no longer
-- existed. Those files are kept for reference in supabase/migrations_archive/ but are
-- NOT an accurate record of the schema. This baseline replaces them.
--
-- Note: this database is SHARED with the Coptic-hub main app, so this baseline also
-- contains tables Poimen does not own (conversations, messages, sources, source_chunks).
--
-- New migrations go in supabase/migrations/ on top of this file.




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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."ensure_invite_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  begin
    if new.role in ('priest', 'servant', 'admin') and new.invite_code is null then
      new.invite_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    end if;
    return new;
  end;
  $$;


ALTER FUNCTION "public"."ensure_invite_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_summary"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Access denied'; end if;
  select jsonb_build_object(
    'total_users',       (select count(*) from profiles),
    'priests',           (select count(*) from profiles where role = 'priest'),
    'servants',          (select count(*) from profiles where role = 'servant'),
    'congregants',       (select count(*) from profiles where role = 'congregant'),
    'active_week',       (select count(*) from profiles where last_seen_at > now() - interval '7 days'),
    'active_month',      (select count(*) from profiles where last_seen_at > now() - interval '30 days'),
    'churches',          (select count(*) from churches),
    'foc_linked',        (select count(*) from profiles where foc_id is not null and role = 'congregant'),
    'total_prayers',     (select count(*) from prayer_requests),
    'answered_prayers',  (select count(*) from prayer_requests where answered = true),
    'total_confessions', (select count(*) from pastoral_encounters where encounter_type = 'confession'),
    'total_encounters',  (select count(*) from pastoral_encounters),
    'active_canons',     (select count(*) from spiritual_canons where active = true),
    'canon_completions', (select count(*) from canon_completions where completed_on >= current_date - 30),
    'journal_users',     (select count(*) from agent_progress where agent_slug = 'journal-entries' and (payload -> 'entries') != '[]'::jsonb),
    'new_this_month',    (select count(*) from profiles where created_at >= date_trunc('month', now())),
    'new_last_month',    (select count(*) from profiles where created_at >= date_trunc('month', now() - interval '1 month') and created_at < date_trunc('month', now()))
  ) into result;
  return result;
end;
$$;


ALTER FUNCTION "public"."get_admin_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_church_breakdown"() RETURNS TABLE("church_id" "uuid", "church_name" "text", "priests" bigint, "servants" bigint, "congregants" bigint, "foc_linked" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then raise exception 'Access denied'; end if;
  return query
  select
    c.id   as church_id,
    c.name as church_name,
    count(*) filter (where p.role = 'priest')                                 as priests,
    count(*) filter (where p.role = 'servant')                                as servants,
    count(*) filter (where p.role = 'congregant')                             as congregants,
    count(*) filter (where p.role = 'congregant' and p.foc_id is not null)    as foc_linked
  from churches c
  left join profiles p on p.church_id = c.id
  group by c.id, c.name
  order by c.name;
end;
$$;


ALTER FUNCTION "public"."get_church_breakdown"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_activity"() RETURNS TABLE("month" "text", "signups" bigint, "prayers" bigint, "confessions" bigint, "canon_completions" bigint, "journal_active" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_admin() then raise exception 'Access denied'; end if;
  return query
  with months as (
    select generate_series(
      date_trunc('month', now() - interval '5 months'),
      date_trunc('month', now()),
      '1 month'::interval
    ) as m
  )
  select
    to_char(m, 'Mon YY') as month,
    (select count(*) from profiles            where date_trunc('month', created_at)      = m) as signups,
    (select count(*) from prayer_requests     where date_trunc('month', created_at)      = m) as prayers,
    (select count(*) from pastoral_encounters where encounter_type = 'confession'
                                               and date_trunc('month', encountered_at)   = m) as confessions,
    (select count(*) from canon_completions   where date_trunc('month', completed_on::timestamptz) = m) as canon_completions,
    (select count(*) from agent_progress      where agent_slug = 'journal-entries'
                                               and date_trunc('month', updated_at)       = m) as journal_active
  from months
  order by m;
end;
$$;


ALTER FUNCTION "public"."get_monthly_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select role from public.profiles where id = auth.uid()
  $$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "p_agent_slug" "text") RETURNS TABLE("id" "uuid", "content" "text", "page" integer, "source_id" "uuid", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
    select sc.id, sc.content, sc.page, sc.source_id,
      1 - (sc.embedding <=> query_embedding) as similarity
    from public.source_chunks sc
    join public.sources s on s.id = sc.source_id
    where s.user_id = auth.uid()
      and s.agent_slug = p_agent_slug
      and s.status = 'ready'
      and 1 - (sc.embedding <=> query_embedding) > match_threshold
    order by sc.embedding <=> query_embedding
    limit match_count;
  $$;


ALTER FUNCTION "public"."match_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "p_agent_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "p_agent_slug" "text", "p_user_id" "uuid") RETURNS TABLE("id" "uuid", "content" "text", "page" integer, "source_id" "uuid", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  select
    sc.id, sc.content, sc.page, sc.source_id,
    1 - (sc.embedding <=> query_embedding) as similarity
  from public.source_chunks sc
  join public.sources s on s.id = sc.source_id
  where s.user_id = p_user_id
    and s.agent_slug = p_agent_slug
    and s.status = 'ready'
    and 1 - (sc.embedding <=> query_embedding) > match_threshold
  order by sc.embedding <=> query_embedding
  limit match_count;
$$;


ALTER FUNCTION "public"."match_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "p_agent_slug" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_slug" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."canon_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "canon_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "completed_on" "date" DEFAULT CURRENT_DATE NOT NULL
);


ALTER TABLE "public"."canon_completions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."churches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."churches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_slug" "text" NOT NULL,
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "citations" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_children" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "birth_year" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pastoral_children" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_contacts" (
    "user_id" "uuid" NOT NULL,
    "phone" "text",
    "email" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "country" "text" DEFAULT 'US'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pastoral_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_encounter_private_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "priest_id" "uuid" NOT NULL,
    "private_note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pastoral_encounter_private_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_encounters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "priest_id" "uuid" NOT NULL,
    "congregant_id" "uuid" NOT NULL,
    "encounter_type" "text" NOT NULL,
    "encountered_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "member_note" "text",
    "outcomes" "text"[],
    "follow_up_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pastoral_encounters_encounter_type_check" CHECK (("encounter_type" = ANY (ARRAY['confession'::"text", 'counseling'::"text", 'advice'::"text", 'visit'::"text", 'phone'::"text", 'group'::"text"])))
);


ALTER TABLE "public"."pastoral_encounters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pastoral_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pastoral_profile" (
    "user_id" "uuid" NOT NULL,
    "life_stage" "text",
    "spouse_name" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pastoral_profile_life_stage_check" CHECK (("life_stage" = ANY (ARRAY['single'::"text", 'engaged'::"text", 'married'::"text", 'widowed'::"text", 'divorced'::"text"])))
);


ALTER TABLE "public"."pastoral_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prayer_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "answered" boolean DEFAULT false NOT NULL,
    "answered_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "body_self" "text",
    "body_foc" "text",
    "body_servant" "text",
    CONSTRAINT "prayer_requests_category_check" CHECK (("category" = ANY (ARRAY['health'::"text", 'family'::"text", 'relationships'::"text", 'work'::"text", 'faith'::"text", '
  gratitude'::"text", 'appointment'::"text", 'other'::"text"]))),
    CONSTRAINT "prayer_requests_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'foc_only'::"text", 'foc_and_servant'::"text", 'servant_only'::"text"])))
);


ALTER TABLE "public"."prayer_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'congregant'::"text" NOT NULL,
    "school_role" "text",
    "class_id" "uuid",
    "foc_id" "uuid",
    "avatar_url" "text",
    "church_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "servant_id" "uuid",
    "foc_consent_at" timestamp with time zone,
    "invite_code" "text",
    "vitals_consent" boolean,
    "last_confession_at" timestamp with time zone,
    "key_backup" "text",
    "public_key" "text",
    "church_id" "uuid",
    "last_seen_at" timestamp with time zone,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['congregant'::"text", 'servant'::"text", 'priest'::"text", 'admin'::"text"]))),
    CONSTRAINT "profiles_school_role_check" CHECK (("school_role" = ANY (ARRAY['teacher'::"text", 'student'::"text", NULL::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "page" integer,
    "chunk_index" integer NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "extensions"."vector"(1024),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."source_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agent_slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "file_path" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_msg" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sources_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spiritual_canons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "priest_id" "uuid",
    "congregant_id" "uuid" NOT NULL,
    "component" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "reflection_prompt" "text",
    "encounter_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."spiritual_canons" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_progress"
    ADD CONSTRAINT "agent_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_progress"
    ADD CONSTRAINT "agent_progress_user_id_agent_slug_key" UNIQUE ("user_id", "agent_slug");



ALTER TABLE ONLY "public"."canon_completions"
    ADD CONSTRAINT "canon_completions_canon_id_user_id_completed_on_key" UNIQUE ("canon_id", "user_id", "completed_on");



ALTER TABLE ONLY "public"."canon_completions"
    ADD CONSTRAINT "canon_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."churches"
    ADD CONSTRAINT "churches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pastoral_children"
    ADD CONSTRAINT "pastoral_children_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pastoral_contacts"
    ADD CONSTRAINT "pastoral_contacts_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."pastoral_encounter_private_notes"
    ADD CONSTRAINT "pastoral_encounter_private_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pastoral_encounters"
    ADD CONSTRAINT "pastoral_encounters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pastoral_notes"
    ADD CONSTRAINT "pastoral_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pastoral_profile"
    ADD CONSTRAINT "pastoral_profile_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."prayer_requests"
    ADD CONSTRAINT "prayer_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_invite_code_key" UNIQUE ("invite_code");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_chunks"
    ADD CONSTRAINT "source_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spiritual_canons"
    ADD CONSTRAINT "spiritual_canons_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_profiles_servant_id" ON "public"."profiles" USING "btree" ("servant_id");



CREATE INDEX "source_chunks_embedding_idx" ON "public"."source_chunks" USING "ivfflat" ("embedding" "extensions"."vector_cosine_ops") WITH ("lists"='100');



CREATE OR REPLACE TRIGGER "on_profile_ensure_invite_code" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_invite_code"();



ALTER TABLE ONLY "public"."agent_progress"
    ADD CONSTRAINT "agent_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."canon_completions"
    ADD CONSTRAINT "canon_completions_canon_id_fkey" FOREIGN KEY ("canon_id") REFERENCES "public"."spiritual_canons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."canon_completions"
    ADD CONSTRAINT "canon_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_children"
    ADD CONSTRAINT "pastoral_children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_contacts"
    ADD CONSTRAINT "pastoral_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_encounter_private_notes"
    ADD CONSTRAINT "pastoral_encounter_private_notes_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."pastoral_encounters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_encounter_private_notes"
    ADD CONSTRAINT "pastoral_encounter_private_notes_priest_id_fkey" FOREIGN KEY ("priest_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_encounters"
    ADD CONSTRAINT "pastoral_encounters_congregant_id_fkey" FOREIGN KEY ("congregant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_encounters"
    ADD CONSTRAINT "pastoral_encounters_priest_id_fkey" FOREIGN KEY ("priest_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pastoral_notes"
    ADD CONSTRAINT "pastoral_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_notes"
    ADD CONSTRAINT "pastoral_notes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pastoral_profile"
    ADD CONSTRAINT "pastoral_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prayer_requests"
    ADD CONSTRAINT "prayer_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "public"."churches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_foc_id_fkey" FOREIGN KEY ("foc_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_servant_id_fkey" FOREIGN KEY ("servant_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."source_chunks"
    ADD CONSTRAINT "source_chunks_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_canons"
    ADD CONSTRAINT "spiritual_canons_congregant_id_fkey" FOREIGN KEY ("congregant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spiritual_canons"
    ADD CONSTRAINT "spiritual_canons_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."pastoral_encounters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."spiritual_canons"
    ADD CONSTRAINT "spiritual_canons_priest_id_fkey" FOREIGN KEY ("priest_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admin deletes churches" ON "public"."churches" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "Admin inserts churches" ON "public"."churches" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin reads all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admin updates churches" ON "public"."churches" FOR UPDATE USING ("public"."is_admin"());



CREATE POLICY "Anyone reads churches" ON "public"."churches" FOR SELECT USING (true);



CREATE POLICY "Congregant self-assigns canon" ON "public"."spiritual_canons" FOR INSERT WITH CHECK ((("congregant_id" = "auth"."uid"()) AND ("priest_id" IS NULL)));



CREATE POLICY "Congregant updates own self-assigned canon" ON "public"."spiritual_canons" FOR UPDATE USING ((("congregant_id" = "auth"."uid"()) AND ("priest_id" IS NULL))) WITH CHECK ((("congregant_id" = "auth"."uid"()) AND ("priest_id" IS NULL)));



CREATE POLICY "FOC reads flock vitals" ON "public"."agent_progress" FOR SELECT USING ((("agent_slug" = 'vitals'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "agent_progress"."user_id") AND ("profiles"."foc_id" = "auth"."uid"()) AND ("profiles"."foc_consent_at" IS NOT NULL) AND ("profiles"."vitals_consent" = true))))));



CREATE POLICY "Priest/servant reads linked congregant canons" ON "public"."spiritual_canons" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "spiritual_canons"."congregant_id") AND (("p"."foc_id" = "auth"."uid"()) OR ("p"."servant_id" = "auth"."uid"()))))));



CREATE POLICY "Servant reads servant-shared requests" ON "public"."prayer_requests" FOR SELECT USING ((("visibility" = ANY (ARRAY['servant_only'::"text", 'foc_and_servant'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "prayer_requests"."user_id") AND ("profiles"."servant_id" = "auth"."uid"()))))));



CREATE POLICY "Servants can assign canons to their students" ON "public"."spiritual_canons" FOR INSERT WITH CHECK ((("priest_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "spiritual_canons"."congregant_id") AND ("profiles"."servant_id" = "auth"."uid"()))))));



CREATE POLICY "Servants can read canons they assigned" ON "public"."spiritual_canons" FOR SELECT USING (("priest_id" = "auth"."uid"()));



ALTER TABLE "public"."agent_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_progress: own" ON "public"."agent_progress" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."canon_completions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "canon_completions: own" ON "public"."canon_completions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "canons: congregant reads own" ON "public"."spiritual_canons" FOR SELECT USING (("auth"."uid"() = "congregant_id"));



CREATE POLICY "canons: priest owns" ON "public"."spiritual_canons" USING (("auth"."uid"() = "priest_id"));



CREATE POLICY "canons: servant insert restricted" ON "public"."spiritual_canons" AS RESTRICTIVE FOR INSERT WITH CHECK (((NOT (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."school_role" = 'teacher'::"text"))))) OR ("component" ~~* ANY (ARRAY['%agpeya%'::"text", '%prayer%'::"text", '%psalm%'::"text", '%scripture%'::"text", '%gospel%'::"text", '%epistle%'::"text", '%bible%'::"text", '%reading%'::"text", '%compline%'::"text", '%vespers%'::"text", '%tasbeha%'::"text", '%praises%'::"text"]))));



ALTER TABLE "public"."churches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations: own" ON "public"."conversations" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "encounter_private_notes: priest owns" ON "public"."pastoral_encounter_private_notes" USING (("auth"."uid"() = "priest_id"));



CREATE POLICY "encounters: congregant reads own" ON "public"."pastoral_encounters" FOR SELECT USING (("auth"."uid"() = "congregant_id"));



CREATE POLICY "encounters: priest owns" ON "public"."pastoral_encounters" USING (("auth"."uid"() = "priest_id"));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages: own conversations" ON "public"."messages" USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "no role escalation" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND ("role" = "public"."get_my_role"())));



CREATE POLICY "own row" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."pastoral_children" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pastoral_children_foc_read" ON "public"."pastoral_children" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "pastoral_children"."parent_id") AND ("profiles"."foc_id" = "auth"."uid"()) AND ("profiles"."foc_consent_at" IS NOT NULL)))));



CREATE POLICY "pastoral_children_self" ON "public"."pastoral_children" USING (("auth"."uid"() = "parent_id")) WITH CHECK (("auth"."uid"() = "parent_id"));



ALTER TABLE "public"."pastoral_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pastoral_contacts_foc_read" ON "public"."pastoral_contacts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "pastoral_contacts"."user_id") AND ("profiles"."foc_id" = "auth"."uid"()) AND ("profiles"."foc_consent_at" IS NOT NULL)))));



CREATE POLICY "pastoral_contacts_self" ON "public"."pastoral_contacts" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."pastoral_encounter_private_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pastoral_encounters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pastoral_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pastoral_notes_own" ON "public"."pastoral_notes" USING (("auth"."uid"() = "author_id")) WITH CHECK (("auth"."uid"() = "author_id"));



ALTER TABLE "public"."pastoral_profile" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pastoral_profile_foc_read" ON "public"."pastoral_profile" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "pastoral_profile"."user_id") AND ("profiles"."foc_id" = "auth"."uid"()) AND ("profiles"."foc_consent_at" IS NOT NULL)))));



CREATE POLICY "pastoral_profile_self" ON "public"."pastoral_profile" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "prayer: foc reads foc_only" ON "public"."prayer_requests" FOR SELECT USING ((("visibility" = 'foc_only'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['priest'::"text", 'admin'::"text"])) AND (EXISTS ( SELECT 1
           FROM "public"."profiles" "c"
          WHERE (("c"."id" = "prayer_requests"."user_id") AND ("c"."foc_id" = "auth"."uid"())))))))));



CREATE POLICY "prayer: own" ON "public"."prayer_requests" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."prayer_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "priest sees flock" ON "public"."profiles" FOR SELECT USING ((("foc_id" = "auth"."uid"()) AND ("public"."get_my_role"() = ANY (ARRAY['priest'::"text", 'admin'::"text"]))));



CREATE POLICY "priest servant profiles are discoverable" ON "public"."profiles" FOR SELECT USING (("role" = ANY (ARRAY['priest'::"text", 'servant'::"text", 'admin'::"text"])));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "servant sees students" ON "public"."profiles" FOR SELECT USING ((("servant_id" = "auth"."uid"()) AND ("public"."get_my_role"() = ANY (ARRAY['servant'::"text", 'admin'::"text"]))));



ALTER TABLE "public"."source_chunks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "source_chunks: own sources" ON "public"."source_chunks" USING ((EXISTS ( SELECT 1
   FROM "public"."sources" "s"
  WHERE (("s"."id" = "source_chunks"."source_id") AND ("s"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sources: own" ON "public"."sources" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."spiritual_canons" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";












































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."ensure_invite_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_invite_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_invite_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_church_breakdown"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_church_breakdown"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_church_breakdown"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";









GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";






























GRANT ALL ON TABLE "public"."agent_progress" TO "anon";
GRANT ALL ON TABLE "public"."agent_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_progress" TO "service_role";



GRANT ALL ON TABLE "public"."canon_completions" TO "anon";
GRANT ALL ON TABLE "public"."canon_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."canon_completions" TO "service_role";



GRANT ALL ON TABLE "public"."churches" TO "anon";
GRANT ALL ON TABLE "public"."churches" TO "authenticated";
GRANT ALL ON TABLE "public"."churches" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_children" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_children" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_children" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_contacts" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_encounter_private_notes" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_encounter_private_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_encounter_private_notes" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_encounters" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_encounters" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_encounters" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_notes" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_notes" TO "service_role";



GRANT ALL ON TABLE "public"."pastoral_profile" TO "anon";
GRANT ALL ON TABLE "public"."pastoral_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."pastoral_profile" TO "service_role";



GRANT ALL ON TABLE "public"."prayer_requests" TO "anon";
GRANT ALL ON TABLE "public"."prayer_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."prayer_requests" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."source_chunks" TO "anon";
GRANT ALL ON TABLE "public"."source_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."source_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."sources" TO "anon";
GRANT ALL ON TABLE "public"."sources" TO "authenticated";
GRANT ALL ON TABLE "public"."sources" TO "service_role";



GRANT ALL ON TABLE "public"."spiritual_canons" TO "anon";
GRANT ALL ON TABLE "public"."spiritual_canons" TO "authenticated";
GRANT ALL ON TABLE "public"."spiritual_canons" TO "service_role";









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




































-- Trigger on auth.users, recreated here because `supabase db dump` only emits the
-- public schema and therefore silently omits it. It calls handle_new_user() to insert
-- the profiles row on signup — without it, registration creates an auth user with no
-- profile and the app breaks on first load.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
