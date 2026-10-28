-- Run as project owner in the Supabase SQL editor of an isolated test project.
-- Metadata only: no order/customer rows, emails, updates or policy changes.
BEGIN READ ONLY;

SELECT n.nspname AS schema_name,c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','storage') AND c.relkind='r'
  AND c.relname IN ('orders','order_items','customer_profiles','vh_page_revisions','site_settings','products','objects')
ORDER BY 1,2;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE (schemaname='public' AND tablename IN ('orders','order_items','customer_profiles','vh_page_revisions','site_settings','products'))
   OR (schemaname='storage' AND tablename='objects')
ORDER BY schemaname,tablename,policyname;

SELECT grantee,table_schema,table_name,privilege_type
FROM information_schema.role_table_grants
WHERE grantee IN ('anon','authenticated') AND table_schema='public'
  AND table_name IN ('orders','order_items','customer_profiles','vh_page_revisions','site_settings')
ORDER BY table_name,grantee,privilege_type;

SELECT grantee,table_name,column_name,privilege_type
FROM information_schema.column_privileges
WHERE grantee IN ('anon','authenticated') AND table_schema='public'
  AND table_name IN ('orders','order_items','customer_profiles')
ORDER BY table_name,grantee,column_name;

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,p.proconfig AS function_settings,
       has_function_privilege('anon',p.oid,'EXECUTE') AS guest_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS customer_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('vh_create_checkout_order','is_admin')
ORDER BY p.proname;

-- Review authoritative price calculation, transaction/row locks and ownership
-- inside the actually deployed checkout function before changing any grants.
SELECT pg_get_functiondef(p.oid) AS checkout_definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='vh_create_checkout_order';

COMMIT;
