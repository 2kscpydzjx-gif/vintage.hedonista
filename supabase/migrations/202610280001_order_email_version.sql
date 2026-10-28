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
COMMIT;
