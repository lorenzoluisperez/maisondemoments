ALTER TABLE "payment_entries" ALTER COLUMN "confirmed_by" DROP NOT NULL;
--> statement-breakpoint
INSERT INTO packages (code, name, terms_snapshot, active)
VALUES
  ('WEDDING_ESSENTIAL', 'Wedding Essential', '{"revisionRounds":2,"galleryPhotos":12,"households":500,"hostingDaysAfterEvent":90}'::jsonb, true),
  ('WEDDING_SIGNATURE', 'Wedding Signature', '{"revisionRounds":2,"galleryPhotos":12,"households":500,"hostingDaysAfterEvent":90}'::jsonb, true),
  ('WEDDING_COUTURE', 'Wedding Couture', '{"revisionRounds":2,"galleryPhotos":12,"households":500,"hostingDaysAfterEvent":90}'::jsonb, true)
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
INSERT INTO product_offers (product_slug, tier)
VALUES
  ('garden-romance', 'ESSENTIAL'), ('garden-romance', 'SIGNATURE'),
  ('coastal-romance', 'ESSENTIAL'), ('coastal-romance', 'SIGNATURE'),
  ('heritage-romance', 'ESSENTIAL'), ('heritage-romance', 'SIGNATURE')
ON CONFLICT (product_slug, tier) DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_payment_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  original payment_entries%ROWTYPE;
  order_currency text;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Payment entries are immutable; record a reversal'; END IF;
  IF NEW.confirmed_by IS NULL THEN
    IF NEW.method <> 'PAYMONGO' OR NEW.external_reference IS NULL THEN
      RAISE EXCEPTION 'Provider receipt requires a payment reference';
    END IF;
  ELSIF NEW.method = 'PAYMONGO' THEN
    RAISE EXCEPTION 'Provider receipts cannot be entered manually';
  ELSIF NOT EXISTS (
    SELECT 1 FROM accounts account JOIN staff_memberships membership ON membership.account_id = account.id
    WHERE account.id = NEW.confirmed_by AND account.active AND membership.role = 'ADMIN'
  ) THEN RAISE EXCEPTION 'Admin permission required'; END IF;
  SELECT currency INTO order_currency FROM job_orders WHERE id = NEW.job_order_id;
  IF order_currency IS NULL OR NEW.currency <> order_currency THEN RAISE EXCEPTION 'Payment currency must match the order'; END IF;
  IF NEW.reversal_of_id IS NULL THEN
    IF NEW.amount_minor <= 0 THEN RAISE EXCEPTION 'Payment receipt must be positive'; END IF;
  ELSE
    SELECT * INTO original FROM payment_entries WHERE id = NEW.reversal_of_id FOR UPDATE;
    IF original.id IS NULL OR original.reversal_of_id IS NOT NULL THEN RAISE EXCEPTION 'Payment reversal must reference an original receipt'; END IF;
    IF original.job_order_id <> NEW.job_order_id OR original.currency <> NEW.currency THEN RAISE EXCEPTION 'Payment reversal must match the original order and currency'; END IF;
    IF NEW.amount_minor <> -original.amount_minor THEN RAISE EXCEPTION 'Payment reversal must exactly negate the original receipt'; END IF;
    IF original.method = 'PAYMONGO' AND (NEW.method <> 'PAYMONGO' OR NEW.confirmed_by IS NOT NULL) THEN RAISE EXCEPTION 'Provider refund confirmation required'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION enforce_payment_entry() FROM PUBLIC, anon, authenticated;
