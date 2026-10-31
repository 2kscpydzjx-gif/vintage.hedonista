import {createHash} from 'node:crypto';

// Test-only Vault/pg_net/pgcrypto adapters. Hashing uses PostgreSQL core SHA-256.
// PostgreSQL executes the real migration/ACLs/triggers; no network function exists.
export const dummySecret='11'.repeat(32);
export const dummyHash=createHash('sha256').update(dummySecret).digest('hex');
export async function prepareMailDatabase(db){
 await db.exec([
  'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;',
  'CREATE SCHEMA vault; CREATE SCHEMA net; CREATE SCHEMA extensions;',
  'CREATE TABLE vault.secrets(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,name text UNIQUE NOT NULL,decrypted_secret text NOT NULL);',
  'CREATE VIEW vault.decrypted_secrets AS SELECT id,name,decrypted_secret FROM vault.secrets;',
  "CREATE FUNCTION vault.create_secret(new_secret text,new_name text,new_description text) RETURNS bigint LANGUAGE sql AS $$ INSERT INTO vault.secrets(name,decrypted_secret) VALUES(new_name,new_secret) RETURNING id $$;",
  "CREATE FUNCTION extensions.gen_random_bytes(n integer) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(repeat('11',n),'hex') $$;",
  "CREATE FUNCTION extensions.digest(value text,algorithm text) RETURNS bytea LANGUAGE sql AS $$ SELECT CASE WHEN algorithm='sha256' THEN sha256(convert_to(value,'UTF8')) END $$;",
  'CREATE TABLE public.test_mail_requests(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,url text,body jsonb,headers jsonb);',
  "CREATE FUNCTION net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE request_id bigint; BEGIN IF current_setting('test.mail_queue_failure',true)='true' THEN RAISE EXCEPTION 'mock queue failure'; END IF; INSERT INTO public.test_mail_requests(url,body,headers) VALUES(url,body,headers) RETURNING id INTO request_id; RETURN request_id; END $$;",
  'REVOKE ALL ON SCHEMA vault,net,extensions FROM PUBLIC,anon,authenticated;',
  'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA vault,net,extensions FROM PUBLIC,anon,authenticated;'
 ].join('\n'));
}
