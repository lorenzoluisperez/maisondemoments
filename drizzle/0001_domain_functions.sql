-- Custom SQL migration file, put your code below! --
ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_live_version_fk"
  FOREIGN KEY ("live_version_id") REFERENCES "invitation_versions"("id") ON DELETE RESTRICT;

ALTER TABLE "payment_entries"
  ADD CONSTRAINT "payment_entries_reversal_fk"
  FOREIGN KEY ("reversal_of_id") REFERENCES "payment_entries"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION allocate_job_order_number(p_year integer)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE allocated integer;
BEGIN
  IF p_year < 2020 OR p_year > 9999 THEN RAISE EXCEPTION 'Invalid job-order year'; END IF;
  INSERT INTO job_order_counters (year, last_value) VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = job_order_counters.last_value + 1
  RETURNING last_value INTO allocated;
  RETURN 'JO-' || p_year::text || '-' || lpad(allocated::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION reject_invitation_version_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Invitation versions are immutable'; END;
$$;

CREATE TRIGGER invitation_versions_immutable
BEFORE UPDATE ON invitation_versions
FOR EACH ROW EXECUTE FUNCTION reject_invitation_version_update();

CREATE OR REPLACE FUNCTION claim_background_jobs(p_kind text, p_limit integer, p_lease_seconds integer)
RETURNS SETOF background_jobs LANGUAGE sql AS $$
  WITH candidates AS (
    SELECT id FROM background_jobs
    WHERE kind = p_kind AND available_at <= now()
      AND (state = 'PENDING' OR (state = 'RUNNING' AND leased_until < now()))
    ORDER BY available_at, id FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(p_limit, 20))
  ), claimed AS (
    UPDATE background_jobs AS job
    SET state = 'RUNNING', attempts = job.attempts + 1,
        leased_until = now() + make_interval(secs => greatest(15, least(p_lease_seconds, 900)))
    FROM candidates WHERE job.id = candidates.id RETURNING job.*
  ) SELECT * FROM claimed;
$$;

CREATE OR REPLACE FUNCTION publish_approved_invitation(p_invitation_id uuid, p_version_id uuid, p_admin_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE target_order_id uuid; target_customer_id uuid; quoted bigint; confirmed bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounts a JOIN staff_memberships sm ON sm.account_id = a.id
    WHERE a.id = p_admin_id AND a.active AND sm.role = 'ADMIN'
  ) THEN RAISE EXCEPTION 'Admin permission required'; END IF;

  SELECT i.job_order_id, jo.customer_id, jo.quoted_amount_minor
  INTO target_order_id, target_customer_id, quoted
  FROM invitations i JOIN job_orders jo ON jo.id = i.job_order_id
  WHERE i.id = p_invitation_id FOR UPDATE;

  IF target_order_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM invitation_versions v WHERE v.id = p_version_id AND v.invitation_id = p_invitation_id
  ) THEN RAISE EXCEPTION 'Version does not belong to invitation'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM approvals a WHERE a.version_id = p_version_id AND a.customer_id = target_customer_id
  ) THEN RAISE EXCEPTION 'Exact version has not been approved by the customer'; END IF;

  SELECT coalesce(sum(amount_minor), 0) INTO confirmed FROM payment_entries WHERE job_order_id = target_order_id;
  IF confirmed < quoted THEN RAISE EXCEPTION 'Outstanding balance blocks publication'; END IF;

  UPDATE invitations SET live_version_id = p_version_id, availability = 'LIVE' WHERE id = p_invitation_id;
  UPDATE job_orders
  SET state = CASE WHEN state IN ('READY', 'IN_PRODUCTION') THEN 'DELIVERED' ELSE state END, updated_at = now()
  WHERE id = target_order_id;
  INSERT INTO audit_events (actor_account_id, action, entity_type, entity_id, metadata)
  VALUES (p_admin_id, 'invitation.published', 'invitation', p_invitation_id, jsonb_build_object('version_id', p_version_id));
END;
$$;
