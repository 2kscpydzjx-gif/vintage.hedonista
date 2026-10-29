-- Additive only: no UPDATE, backfill, conversion or changes to existing policies.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS measurements_v2 jsonb;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='measurements_v2' AND data_type='jsonb') THEN
  RAISE EXCEPTION 'products.measurements_v2 must be jsonb; existing data was not changed';
 END IF;
END $$;
COMMENT ON COLUMN public.products.measurements_v2 IS 'Optional versioned garment/component measurements; legacy measurement_* columns remain unchanged.';
NOTIFY pgrst, 'reload schema';
COMMIT;
