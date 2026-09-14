CREATE OR REPLACE FUNCTION queue_customer_notification(p_order_id uuid, p_kind text, p_occurrence_key text, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  delivery_id uuid;
  recipient_email text;
  target_job_number text;
  target_key text;
BEGIN
  IF p_kind NOT IN ('REVIEW_READY', 'INVITATION_PUBLISHED') THEN RAISE EXCEPTION 'Unsupported notification kind'; END IF;
  SELECT account.email, jo.job_number INTO recipient_email, target_job_number
  FROM job_orders jo JOIN accounts account ON account.id = jo.customer_id WHERE jo.id = p_order_id;
  IF recipient_email IS NULL THEN RAISE EXCEPTION 'Notification recipient not found'; END IF;
  target_key := lower(p_kind) || ':' || p_occurrence_key;
  INSERT INTO notification_deliveries (job_order_id, kind, recipient, payload, idempotency_key)
  VALUES (p_order_id, p_kind, recipient_email, p_payload || jsonb_build_object('jobNumber', target_job_number), target_key)
  ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = excluded.idempotency_key
  RETURNING id INTO delivery_id;
  INSERT INTO background_jobs (kind, payload, idempotency_key)
  VALUES ('SEND_EMAIL', jsonb_build_object('deliveryId', delivery_id), 'send-email:' || delivery_id::text)
  ON CONFLICT (idempotency_key) DO NOTHING;
  RETURN delivery_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION queue_customer_notification(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION queue_customer_notification(uuid, text, text, jsonb) TO maison_app, service_role;
