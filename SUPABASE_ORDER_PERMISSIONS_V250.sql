-- Vintage Hedonista V250 — orders RLS
-- Fixes guest checkout while keeping guest PII private.
-- Run once in Supabase > SQL Editor. Safe to re-run.

BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON TABLE public.orders TO anon, authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;

-- Guest checkout only needs the newly created order ID because the frontend
-- immediately sends that ID to the transactional email Edge Function.
-- Do NOT grant anon access to customer/order detail columns.
GRANT SELECT (id) ON TABLE public.orders TO anon;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vh_orders_insert_anon_authenticated" ON public.orders;
CREATE POLICY "vh_orders_insert_anon_authenticated"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NULL AND user_id IS NULL)
  OR
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "vh_orders_select_own" ON public.orders;
CREATE POLICY "vh_orders_select_own"
ON public.orders
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allows a logged-out checkout to receive only the ID returned by INSERT ... RETURNING id.
-- Other order columns remain unavailable to anon because only SELECT(id) is granted.
DROP POLICY IF EXISTS "vh_orders_guest_return_id" ON public.orders;
CREATE POLICY "vh_orders_guest_return_id"
ON public.orders
FOR SELECT
TO anon
USING (user_id IS NULL);

COMMIT;
