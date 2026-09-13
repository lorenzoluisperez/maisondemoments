DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'maison_app') THEN
    CREATE ROLE maison_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO maison_app;

DO $$
DECLARE
  table_name text;
  application_tables text[] := ARRAY[
    'accounts', 'staff_memberships', 'packages', 'job_order_counters', 'job_orders',
    'events', 'event_activities', 'event_participants', 'event_content',
    'artwork_collections', 'media_objects', 'media_variants', 'artwork_assets',
    'themes', 'theme_versions', 'invitations', 'invitation_drafts',
    'invitation_versions', 'version_media_refs', 'approvals', 'review_requests',
    'guest_groups', 'guest_slots', 'guest_links', 'guest_sessions', 'rsvps',
    'rsvp_attendees', 'payment_entries', 'audit_events', 'background_jobs'
  ];
BEGIN
  FOREACH table_name IN ARRAY application_tables LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO maison_app', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', table_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY maison_app_server_access ON public.%I FOR ALL TO maison_app USING (true) WITH CHECK (true)',
      table_name
    );
  END LOOP;
END
$$;

REVOKE UPDATE, DELETE ON TABLE public.audit_events FROM maison_app;

REVOKE EXECUTE ON FUNCTION public.allocate_job_order_number(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_background_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.publish_approved_invitation(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_invitation_version_update() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.allocate_job_order_number(integer) TO maison_app, service_role;
GRANT EXECUTE ON FUNCTION public.claim_background_jobs(text, integer, integer) TO maison_app, service_role;
GRANT EXECUTE ON FUNCTION public.publish_approved_invitation(uuid, uuid, uuid) TO maison_app, service_role;

ALTER FUNCTION public.allocate_job_order_number(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.claim_background_jobs(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.publish_approved_invitation(uuid, uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.reject_invitation_version_update() SET search_path = public, pg_temp;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
