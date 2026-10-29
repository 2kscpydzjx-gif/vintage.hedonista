-- Adds measurement storage and an admin-only, compare-and-set save operation.
-- No UPDATE/backfill of existing rows and no changes to existing product policies.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS measurements_v2 jsonb;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='measurements_v2' AND data_type='jsonb') THEN
  RAISE EXCEPTION 'products.measurements_v2 must be jsonb; existing data was not changed';
 END IF;
 IF to_regprocedure('public.is_admin()') IS NULL THEN
  RAISE EXCEPTION 'Existing public.is_admin() is required; no changes were applied';
 END IF;
END $$;
COMMENT ON COLUMN public.products.measurements_v2 IS 'Optional versioned measurements; legacy measurement_* columns remain unchanged.';

CREATE OR REPLACE FUNCTION public.vh_product_measurements_valid(p_data jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE part jsonb; field jsonb; group_ids text[] := '{}'; field_ids text[]; is_list boolean;
BEGIN
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object'
  OR p_data->'version' IS DISTINCT FROM '1'::jsonb
  OR jsonb_typeof(p_data->'showLegacy') IS DISTINCT FROM 'boolean'
  OR jsonb_typeof(p_data->'groups') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF p_data ? 'layout' AND p_data->'layout' IS DISTINCT FROM '"list"'::jsonb THEN RETURN false; END IF;
 is_list := p_data->>'layout' = 'list';
 IF jsonb_array_length(p_data->'groups') > (CASE WHEN is_list THEN 1 ELSE 12 END) THEN RETURN false; END IF;
 FOR part IN SELECT value FROM jsonb_array_elements(p_data->'groups') LOOP
  IF jsonb_typeof(part->'id') IS DISTINCT FROM 'string'
   OR part->>'id' = ANY(group_ids)
   OR jsonb_typeof(part->'title') IS DISTINCT FROM 'string'
   OR length(btrim(part->>'title')) = 0 OR length(part->>'title') > 120
   OR jsonb_typeof(part->'fields') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(part->'fields') > (CASE WHEN is_list THEN 500 ELSE 40 END) THEN RETURN false; END IF;
  group_ids := array_append(group_ids, part->>'id'); field_ids := '{}';
  FOR field IN SELECT value FROM jsonb_array_elements(part->'fields') LOOP
   IF jsonb_typeof(field->'id') IS DISTINCT FROM 'string'
    OR field->>'id' = ANY(field_ids)
    OR jsonb_typeof(field->'label') IS DISTINCT FROM 'string'
    OR jsonb_typeof(field->'value') IS DISTINCT FROM 'string'
    OR length(field->>'label') > (CASE WHEN is_list THEN 300 ELSE 120 END)
    OR length(field->>'value') > 300
    OR (length(btrim(field->>'value')) > 0 AND length(btrim(field->>'label')) = 0) THEN RETURN false; END IF;
   field_ids := array_append(field_ids, field->>'id');
  END LOOP;
 END LOOP;
 RETURN true;
END $$;

-- Protect the new column even when older product policies are too broad.
CREATE OR REPLACE FUNCTION public.vh_guard_product_measurements()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF NEW.measurements_v2 IS NOT DISTINCT FROM OLD.measurements_v2 THEN RETURN NEW; END IF;
 ELSIF NEW.measurements_v2 IS NULL THEN RETURN NEW;
 END IF;
 IF current_user NOT IN ('postgres','supabase_admin')
  AND coalesce(auth.role(),'') <> 'service_role'
  AND NOT coalesce(public.is_admin(),false) THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Only administrators can change product measurements';
 END IF;
 IF NEW.measurements_v2 IS NOT NULL AND NOT public.vh_product_measurements_valid(NEW.measurements_v2) THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid product measurement format';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vh_product_measurements_guard ON public.products;
CREATE TRIGGER vh_product_measurements_guard
 BEFORE INSERT OR UPDATE OF measurements_v2 ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.vh_guard_product_measurements();

CREATE OR REPLACE FUNCTION public.vh_save_product_measurements(p_product_id text, p_expected jsonb, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE saved jsonb;
BEGIN
 IF NOT coalesce(public.is_admin(),false) THEN
  RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Only administrators can save product measurements';
 END IF;
 IF p_data IS NOT NULL AND NOT public.vh_product_measurements_valid(p_data) THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Invalid product measurement format';
 END IF;
 UPDATE public.products SET measurements_v2 = p_data
  WHERE id::text = p_product_id AND measurements_v2 IS NOT DISTINCT FROM p_expected
  RETURNING jsonb_build_object('id',id::text,'measurements_v2',measurements_v2) INTO saved;
 IF saved IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Product measurements changed or product is not available';
 END IF;
 RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.vh_save_product_measurements(text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vh_save_product_measurements(text,jsonb,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
