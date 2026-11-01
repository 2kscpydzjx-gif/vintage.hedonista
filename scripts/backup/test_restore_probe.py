import os
from pathlib import Path
import shutil
import tempfile
import unittest

import restore_probe
import run as backup


class RecoveryGuards(unittest.TestCase):
    def test_copy_fingerprint_covers_prices_measurements_and_escaped_newlines(self):
        sql = 'COPY "public"."products" ("id", "price", "measurements", "description") FROM stdin;\n1\t500\t{"length": 60}\tfirst\\nsecond\n2\t700\t{}\t\\N\n\\.\n'
        parsed = restore_probe.copy_tables(sql)
        value = parsed[("public", "products")]
        self.assertEqual(value["count"], 2)
        changed = restore_probe.copy_tables(sql.replace('1\t500\t', '1\t501\t'))
        self.assertNotEqual(value["digest"], changed[("public", "products")]["digest"])
        reversed_rows = 'COPY "public"."products" ("id", "price", "measurements", "description") FROM stdin;\n2\t700\t{}\t\\N\n1\t500\t{"length": 60}\tfirst\\nsecond\n\\.\n'
        self.assertEqual(value["digest"], restore_probe.copy_tables(reversed_rows)[("public", "products")]["digest"])

    def test_incomplete_or_unsafe_copy_is_rejected(self):
        for text in ['COPY "public"."products" ("id") FROM stdin;\n1\n',
                     'COPY "public"."products" ("id"); DROP TABLE users; --) FROM stdin;\n1\n\\.\n']:
            with self.assertRaises(restore_probe.ProbeError):
                restore_probe.copy_tables(text)

    def test_copy_keeps_unicode_line_separators_inside_a_row(self):
        parsed = restore_probe.copy_tables('COPY "public"."products" ("description") FROM stdin;\nfirst\u2028second\n\n\\.\n')
        self.assertEqual(parsed[("public", "products")]["count"], 2)

    def test_source_credentials_cannot_reach_local_database_tools(self):
        source = {"PATH": "/tools", "BACKUP_DATABASE_URL": "secret", "SUPABASE_ACCESS_TOKEN": "secret", "RESTIC_PASSWORD": "secret",
                  "RCLONE_CONFIG": "private-file", "PGHOST": "production", "DOCKER_HOST": "tcp://remote", "DOCKER_CONFIG": "/registry-config"}
        self.assertEqual(restore_probe.local_environment(source), {"PATH": "/tools", "DOCKER_CONFIG": "/registry-config"})

    def test_configuration_disables_services_and_source_migrations(self):
        sections = ["api", "auth", "storage", "realtime", "studio", "inbucket", "edge_runtime", "analytics", "db.migrations", "db.seed"]
        text = 'project_id = "fixture"\n[db]\nmajor_version = 17\n' + ''.join('[' + s + ']\nenabled = true\n' for s in sections)
        configured = restore_probe.configure(text, "vintazhka-restore-123456abcdef")
        self.assertNotIn('enabled = true', configured)
        with self.assertRaises(restore_probe.ProbeError):
            restore_probe.configure(text, backup.CONFIG["project_ref"])

    def test_old_snapshot_requires_new_schema_before_docker_runs(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaises(restore_probe.ProbeError):
                restore_probe.probe(root, root, lambda *a, **kw: self.fail("Must not launch tools for incomplete snapshot"))


@unittest.skipUnless(os.environ.get("BACKUP_TEST_DOCKER") == "1", "Docker integration runs on the isolated GitHub runner")
class LocalDatabaseIntegration(unittest.TestCase):
    def test_recovery_into_disconnected_postgres_with_synthetic_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            bundle = root / "bundle"
            database = bundle / "database"
            database.mkdir(parents=True)
            schema = '''CREATE SCHEMA public;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE SCHEMA vh_private;
CREATE TABLE public.products(id int, price int, measurements jsonb);
CREATE TABLE public.orders(id int);
CREATE TABLE auth.users(id int, email text);
CREATE TABLE storage.objects(id int);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.orders TO anon;
'''
            (database / "roles.sql").write_text("-- No custom roles in the fixture\n")
            (database / "schema.sql").write_text("-- No extra extensions in the fixture\n")
            (database / "restore-schema.sql").write_text(schema)
            (database / "data.sql").write_text('''SET session_replication_role = replica;
COPY "public"."products" ("id", "price", "measurements") FROM stdin;
1	500	{"length": 60}
\\.
COPY "public"."orders" ("id") FROM stdin;
39
\\.
COPY "auth"."users" ("id", "email") FROM stdin;
1	buyer@example.invalid
\\.
COPY "storage"."objects" ("id") FROM stdin;
1
\\.
RESET ALL;
''')
            (database / "history-schema.sql").write_text('CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text);\n')
            (database / "history-data.sql").write_text('COPY "supabase_migrations"."schema_migrations" ("version") FROM stdin;\n202610280001\n\\.\n')
            result = restore_probe.probe(bundle, root, backup.call, env=dict(os.environ))
            self.assertTrue(result["full_database_restore_verified"])
            self.assertEqual(result["tables_verified"], 5)
            self.assertEqual(result["rows_verified"], 5)
            self.assertFalse(result["production_database_modified"])


if __name__ == "__main__":
    unittest.main()
