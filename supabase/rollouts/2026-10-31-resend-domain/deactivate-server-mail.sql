-- Stops new database notifications without deleting orders, event history,
-- Vault state, or touching the existing Telegram/inventory triggers.
-- To restore browser delivery as before, also restore the v14 compatibility
-- function and remove orderEmailTransport="webhook" from both client configs.
ALTER TABLE public.orders DISABLE TRIGGER zz_vh_order_email_webhook;
