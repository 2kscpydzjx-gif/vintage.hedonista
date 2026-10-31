-- Staged for an isolated test project. Not applied to the shared live database.
-- No inventory, prices, customer values or RLS policies are rewritten.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vh_email_version bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.vh_order_email_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.vh_email_version := 1;
 ELSIF NEW.status IS DISTINCT FROM OLD.status
    OR (NEW.status='shipped' AND (to_jsonb(NEW)->>'ttn') IS DISTINCT FROM (to_jsonb(OLD)->>'ttn')) THEN
  NEW.vh_email_version := OLD.vh_email_version + 1;
 ELSE
  NEW.vh_email_version := OLD.vh_email_version;
 END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_vh_order_email_version ON public.orders;
CREATE TRIGGER zz_vh_order_email_version BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.vh_order_email_version();

-- Vault and pg_net already exist in the hosted project. No key is stored in SQL,
-- trigger arguments, source control, a public table, or the browser.
CREATE SCHEMA IF NOT EXISTS vh_private;
REVOKE ALL ON SCHEMA vh_private FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
 IF to_regnamespace('vault') IS NULL OR to_regnamespace('net') IS NULL THEN
  RAISE EXCEPTION 'Order mail requires Supabase Vault and pg_net';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='vh_order_email_webhook_secret') THEN
  PERFORM vault.create_secret(
   pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),
   'vh_order_email_webhook_secret',
   'Internal order mail webhook credential; never export to clients'
  );
 END IF;
END;
$$;

-- Only the server-side service role can request the hash. Raw secret material
-- stays in Vault; the function never returns it. ACLs are the authorization gate.
CREATE OR REPLACE FUNCTION public.vh_order_email_webhook_secret_hash()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT pg_catalog.encode(extensions.digest(s.decrypted_secret,'sha256'),'hex')
 FROM vault.decrypted_secrets AS s WHERE s.name='vh_order_email_webhook_secret'
$$;
REVOKE ALL ON FUNCTION public.vh_order_email_webhook_secret_hash() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vh_order_email_webhook_secret_hash() TO service_role;

-- This trigger needs elevated access only to read its own Vault credential and
-- enqueue an asynchronous request. It sends identifiers/version, not customer
-- fields, and cannot be called as a normal RPC. Any queue failure leaves the
-- accepted order intact.
CREATE OR REPLACE FUNCTION vh_private.enqueue_order_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
 hook_secret text;
 previous jsonb := NULL;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.vh_email_version=OLD.vh_email_version THEN RETURN NULL; END IF;
  previous := jsonb_build_object('status',OLD.status,'vh_email_version',OLD.vh_email_version);
 END IF;
 IF NEW.status NOT IN ('new','confirmed','shipped','received','cancelled') THEN RETURN NULL; END IF;
 IF NEW.status='shipped' AND coalesce(btrim(to_jsonb(NEW)->>'ttn'),'')='' THEN RETURN NULL; END IF;
 SELECT s.decrypted_secret INTO hook_secret FROM vault.decrypted_secrets AS s
 WHERE s.name='vh_order_email_webhook_secret';
 IF hook_secret IS NULL OR length(hook_secret)<32 THEN
  RAISE WARNING 'Order mail enqueue skipped: credential unavailable';
  RETURN NULL;
 END IF;
 PERFORM net.http_post(
  url := 'https://yffwjgwwkapdrpwyjwfp.supabase.co/functions/v1/resend-email',
  body := jsonb_build_object(
   'schema',TG_TABLE_SCHEMA,'table',TG_TABLE_NAME,'type',TG_OP,
   'record',jsonb_build_object('id',NEW.id,'status',NEW.status,'vh_email_version',NEW.vh_email_version),
   'old_record',previous
  ),
  headers := jsonb_build_object('Content-Type','application/json','X-VH-Webhook-Secret',hook_secret),
  timeout_milliseconds := 5000
 );
 RETURN NULL;
EXCEPTION WHEN OTHERS THEN
 RAISE WARNING 'Order mail enqueue failed (%); order preserved',SQLSTATE;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION vh_private.enqueue_order_email() FROM PUBLIC, anon, authenticated;

-- First installation is inactive until the new handler is deployed and probed.
-- Reapplying this preparation must preserve an operator's activation state.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.orders'::regclass AND tgname='zz_vh_order_email_webhook') THEN
  CREATE TRIGGER zz_vh_order_email_webhook AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION vh_private.enqueue_order_email();
  ALTER TABLE public.orders DISABLE TRIGGER zz_vh_order_email_webhook;
 END IF;
END;
$$;
COMMIT;
