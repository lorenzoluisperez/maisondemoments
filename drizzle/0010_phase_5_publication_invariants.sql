REVOKE ALL ON TABLE public.review_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.review_items TO maison_app, service_role;
ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY maison_app_server_access ON public.review_items
  FOR ALL TO maison_app USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION enforce_version_customer_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE expected_customer_id uuid;
BEGIN
  SELECT jo.customer_id INTO expected_customer_id
  FROM invitation_versions version
  JOIN invitations invitation ON invitation.id = version.invitation_id
  JOIN job_orders jo ON jo.id = invitation.job_order_id
  WHERE version.id = NEW.version_id;

  IF expected_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invitation version was not found';
  END IF;
  IF TG_TABLE_NAME = 'approvals' THEN
    IF NEW.customer_id <> expected_customer_id THEN
      RAISE EXCEPTION 'Approval customer does not own the invitation';
    END IF;
  ELSIF TG_TABLE_NAME = 'review_requests' THEN
    IF NEW.requested_by <> expected_customer_id THEN
      RAISE EXCEPTION 'Review requester does not own the invitation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER approval_customer_guard
BEFORE INSERT OR UPDATE ON approvals
FOR EACH ROW EXECUTE FUNCTION enforce_version_customer_actor();

CREATE TRIGGER review_request_customer_guard
BEFORE INSERT OR UPDATE ON review_requests
FOR EACH ROW EXECUTE FUNCTION enforce_version_customer_actor();

CREATE OR REPLACE FUNCTION enforce_live_version_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.live_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM invitation_versions version
    WHERE version.id = NEW.live_version_id AND version.invitation_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Live version does not belong to invitation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER invitation_live_version_guard
BEFORE INSERT OR UPDATE OF live_version_id ON invitations
FOR EACH ROW EXECUTE FUNCTION enforce_live_version_ownership();

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
    WHERE version.id = p_version_id
      AND draft.review_state = 'APPROVED'
      AND draft.revision = version.source_revision
  ) THEN RAISE EXCEPTION 'Approved version is not the current draft revision'; END IF;

  SELECT coalesce(sum(entry.amount_minor), 0) INTO confirmed
  FROM payment_entries entry WHERE entry.job_order_id = target_order_id;
  IF confirmed < quoted THEN RAISE EXCEPTION 'Outstanding balance blocks publication'; END IF;

  UPDATE invitations SET
    live_version_id = p_version_id,
    availability = 'LIVE',
    published_at = coalesce(published_at, now()),
    updated_at = now()
  WHERE id = p_invitation_id;
  UPDATE job_orders SET
    state = CASE WHEN state IN ('READY', 'IN_PRODUCTION') THEN 'DELIVERED' ELSE state END,
    updated_at = now()
  WHERE id = target_order_id;
  INSERT INTO audit_events (actor_account_id, action, entity_type, entity_id, metadata)
  VALUES (p_admin_id, 'invitation.published', 'invitation', p_invitation_id, jsonb_build_object('version_id', p_version_id));
END;
$$;

CREATE OR REPLACE FUNCTION rollback_approved_invitation(p_invitation_id uuid, p_version_id uuid, p_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  target_order_id uuid;
  target_customer_id uuid;
  current_version_id uuid;
  current_renderer text;
  target_renderer text;
  target_availability invitation_availability;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounts account
    JOIN staff_memberships membership ON membership.account_id = account.id
    WHERE account.id = p_admin_id AND account.active AND membership.role = 'ADMIN'
  ) THEN RAISE EXCEPTION 'Admin permission required'; END IF;

  SELECT invitation.job_order_id, jo.customer_id, invitation.live_version_id, invitation.availability
  INTO target_order_id, target_customer_id, current_version_id, target_availability
  FROM invitations invitation
  JOIN job_orders jo ON jo.id = invitation.job_order_id
  WHERE invitation.id = p_invitation_id
  FOR UPDATE;

  IF target_order_id IS NULL OR current_version_id IS NULL OR target_availability NOT IN ('LIVE', 'SUSPENDED') THEN
    RAISE EXCEPTION 'Invitation has no live version to roll back';
  END IF;
  SELECT renderer_version INTO current_renderer FROM invitation_versions WHERE id = current_version_id;
  SELECT renderer_version INTO target_renderer FROM invitation_versions
  WHERE id = p_version_id AND invitation_id = p_invitation_id;
  IF target_renderer IS NULL THEN RAISE EXCEPTION 'Version does not belong to invitation'; END IF;
  IF target_renderer <> current_renderer THEN RAISE EXCEPTION 'Renderer compatibility blocks rollback'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM approvals approval
    WHERE approval.version_id = p_version_id AND approval.customer_id = target_customer_id
  ) THEN RAISE EXCEPTION 'Rollback requires a customer-approved version'; END IF;

  UPDATE invitations SET live_version_id = p_version_id, updated_at = now() WHERE id = p_invitation_id;
  INSERT INTO audit_events (actor_account_id, action, entity_type, entity_id, metadata)
  VALUES (p_admin_id, 'invitation.rolled_back', 'invitation', p_invitation_id,
    jsonb_build_object('from_version_id', current_version_id, 'to_version_id', p_version_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION enforce_version_customer_actor() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION enforce_live_version_ownership() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION rollback_approved_invitation(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rollback_approved_invitation(uuid, uuid, uuid) TO maison_app, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
