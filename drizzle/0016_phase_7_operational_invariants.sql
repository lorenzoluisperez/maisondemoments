DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['media_backups', 'notification_deliveries', 'deletion_records']
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO maison_app, service_role', table_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY maison_app_server_access ON public.%I FOR ALL TO maison_app USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION enforce_payment_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  original payment_entries%ROWTYPE;
  order_currency text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounts account
    JOIN staff_memberships membership ON membership.account_id = account.id
    WHERE account.id = NEW.confirmed_by AND account.active AND membership.role = 'ADMIN'
  ) THEN RAISE EXCEPTION 'Admin permission required'; END IF;

  SELECT currency INTO order_currency FROM job_orders WHERE id = NEW.job_order_id;
  IF order_currency IS NULL OR NEW.currency <> order_currency THEN
    RAISE EXCEPTION 'Payment currency must match the order';
  END IF;

  IF NEW.reversal_of_id IS NULL THEN
    IF NEW.amount_minor <= 0 THEN RAISE EXCEPTION 'Payment receipt must be positive'; END IF;
  ELSE
    SELECT * INTO original FROM payment_entries WHERE id = NEW.reversal_of_id FOR UPDATE;
    IF original.id IS NULL OR original.reversal_of_id IS NOT NULL THEN
      RAISE EXCEPTION 'Payment reversal must reference an original receipt';
    END IF;
    IF original.job_order_id <> NEW.job_order_id OR original.currency <> NEW.currency THEN
      RAISE EXCEPTION 'Payment reversal must match the original order and currency';
    END IF;
    IF NEW.amount_minor <> -original.amount_minor THEN
      RAISE EXCEPTION 'Payment reversal must exactly negate the original receipt';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_entry_guard
BEFORE INSERT OR UPDATE ON payment_entries
FOR EACH ROW EXECUTE FUNCTION enforce_payment_entry();

CREATE OR REPLACE FUNCTION publish_approved_invitation(p_invitation_id uuid, p_version_id uuid, p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  target_order_id uuid;
  target_customer_id uuid;
  quoted bigint;
  confirmed bigint;
  target_availability invitation_availability;
  target_expiry timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounts account
    JOIN staff_memberships membership ON membership.account_id = account.id
    WHERE account.id = p_admin_id AND account.active AND membership.role = 'ADMIN'
  ) THEN RAISE EXCEPTION 'Admin permission required'; END IF;

  SELECT invitation.job_order_id, jo.customer_id, jo.quoted_amount_minor, invitation.availability, invitation.expires_at
  INTO target_order_id, target_customer_id, quoted, target_availability, target_expiry
  FROM invitations invitation
  JOIN job_orders jo ON jo.id = invitation.job_order_id
  WHERE invitation.id = p_invitation_id
  FOR UPDATE;

  IF target_order_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM invitation_versions version
    WHERE version.id = p_version_id AND version.invitation_id = p_invitation_id
  ) THEN RAISE EXCEPTION 'Version does not belong to invitation'; END IF;
  IF target_availability IN ('EXPIRED', 'REMOVED') OR target_expiry <= now() THEN
    RAISE EXCEPTION 'Invitation must be active and unexpired before publication';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM approvals approval
    WHERE approval.version_id = p_version_id AND approval.customer_id = target_customer_id
  ) THEN RAISE EXCEPTION 'Exact version has not been approved by the customer'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM invitation_versions version
    JOIN invitation_drafts draft ON draft.invitation_id = version.invitation_id
    WHERE version.id = p_version_id AND draft.review_state = 'APPROVED' AND draft.revision = version.source_revision
  ) THEN RAISE EXCEPTION 'Approved version is not the current draft revision'; END IF;
  IF EXISTS (
    SELECT 1 FROM version_media_refs ref
    JOIN media_objects media ON media.id = ref.media_id
    LEFT JOIN media_backups backup ON backup.media_id = media.id AND backup.state = 'VERIFIED'
    WHERE ref.version_id = p_version_id AND media.usage <> 'CATALOG_ARTWORK' AND backup.id IS NULL
  ) THEN RAISE EXCEPTION 'Verified media backup required before publication'; END IF;

  SELECT coalesce(sum(entry.amount_minor), 0) INTO confirmed
  FROM payment_entries entry WHERE entry.job_order_id = target_order_id;
  IF confirmed < quoted THEN RAISE EXCEPTION 'Outstanding balance blocks publication'; END IF;

  UPDATE invitations SET live_version_id = p_version_id, availability = 'LIVE',
    published_at = coalesce(published_at, now()), updated_at = now()
  WHERE id = p_invitation_id;
  UPDATE job_orders SET state = CASE WHEN state IN ('READY', 'IN_PRODUCTION') THEN 'DELIVERED' ELSE state END, updated_at = now()
  WHERE id = target_order_id;
  INSERT INTO audit_events (actor_account_id, action, entity_type, entity_id, metadata)
  VALUES (p_admin_id, 'invitation.published', 'invitation', p_invitation_id, jsonb_build_object('version_id', p_version_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION enforce_payment_entry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION publish_approved_invitation(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION publish_approved_invitation(uuid, uuid, uuid) TO maison_app, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
