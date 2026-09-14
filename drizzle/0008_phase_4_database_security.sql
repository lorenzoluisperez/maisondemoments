REVOKE ALL ON TABLE public.event_briefs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_briefs TO maison_app, service_role;
ALTER TABLE public.event_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY maison_app_server_access ON public.event_briefs
  FOR ALL TO maison_app USING (true) WITH CHECK (true);

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
