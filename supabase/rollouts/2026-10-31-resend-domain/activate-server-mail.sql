-- Run only after the shared handler has been deployed and authenticated with a
-- harmless webhook probe. TEST_MODE must remain true for the first guest test.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='vh_order_email_webhook_secret') THEN
  RAISE EXCEPTION 'Order mail credential is not prepared';
 END IF;
 IF to_regprocedure('public.vh_order_email_webhook_secret_hash()') IS NULL THEN
  RAISE EXCEPTION 'Order mail hash RPC is not prepared';
 END IF;
END;
$$;
ALTER TABLE public.orders ENABLE TRIGGER zz_vh_order_email_webhook;
COMMIT;
