CREATE OR REPLACE FUNCTION enforce_version_media_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  invitation_order_id uuid;
  invitation_customer_id uuid;
  media_order_id uuid;
  media_owner_id uuid;
  media_state media_state;
BEGIN
  SELECT i.job_order_id, jo.customer_id
  INTO invitation_order_id, invitation_customer_id
  FROM invitation_versions version
  JOIN invitations i ON i.id = version.invitation_id
  JOIN job_orders jo ON jo.id = i.job_order_id
  WHERE version.id = NEW.version_id;

  SELECT media.job_order_id, media.owner_account_id, media.state
  INTO media_order_id, media_owner_id, media_state
  FROM media_objects media
  WHERE media.id = NEW.media_id;

  IF invitation_order_id IS NULL OR media_order_id IS NULL
    OR invitation_order_id <> media_order_id
    OR invitation_customer_id <> media_owner_id THEN
    RAISE EXCEPTION 'Media reference crosses an order or customer boundary';
  END IF;
  IF media_state <> 'READY' THEN
    RAISE EXCEPTION 'Only ready media can be attached to an invitation version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER version_media_ownership_guard
BEFORE INSERT OR UPDATE ON version_media_refs
FOR EACH ROW EXECUTE FUNCTION enforce_version_media_ownership();

CREATE OR REPLACE FUNCTION prevent_referenced_media_deletion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.state = 'DELETED' AND OLD.state <> 'DELETED'
    AND EXISTS (SELECT 1 FROM version_media_refs ref WHERE ref.media_id = NEW.id) THEN
    RAISE EXCEPTION 'Media referenced by a retained invitation version cannot be deleted';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER referenced_media_deletion_guard
BEFORE UPDATE OF state ON media_objects
FOR EACH ROW EXECUTE FUNCTION prevent_referenced_media_deletion();

REVOKE EXECUTE ON FUNCTION enforce_version_media_ownership() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION prevent_referenced_media_deletion() FROM PUBLIC, anon, authenticated;
