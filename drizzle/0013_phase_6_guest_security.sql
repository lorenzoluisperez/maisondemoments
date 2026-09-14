REVOKE ALL ON TABLE public.guest_rate_limits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guest_rate_limits TO maison_app, service_role;
ALTER TABLE public.guest_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY maison_app_server_access ON public.guest_rate_limits
  FOR ALL TO maison_app USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION enforce_rsvp_attendee_household()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  response_group_id uuid;
  slot_group_id uuid;
BEGIN
  SELECT group_id INTO response_group_id FROM rsvps WHERE id = NEW.rsvp_id;
  SELECT group_id INTO slot_group_id FROM guest_slots WHERE id = NEW.slot_id;

  IF response_group_id IS NULL OR slot_group_id IS NULL OR response_group_id <> slot_group_id THEN
    RAISE EXCEPTION 'RSVP attendee seat must belong to the response household';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rsvp_attendee_household_guard
BEFORE INSERT OR UPDATE ON rsvp_attendees
FOR EACH ROW EXECUTE FUNCTION enforce_rsvp_attendee_household();

REVOKE EXECUTE ON FUNCTION enforce_rsvp_attendee_household() FROM PUBLIC, anon, authenticated;

INSERT INTO public.packages (code, name, terms_snapshot, active)
VALUES (
  'SEMI_CUSTOM_MVP',
  'Semi-custom invitation',
  '{"revisionRounds":2,"hostingDaysAfterEvent":90,"galleryPhotoLimit":12,"householdLimit":500,"paymentTerms":{"depositPercent":50,"balanceDueBeforePublication":true}}'::jsonb,
  true
)
ON CONFLICT (code) DO NOTHING;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
