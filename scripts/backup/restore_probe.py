"""Import a recovery snapshot into a disposable, disconnected local Postgres.

There is no target URL argument: a remote/production database cannot be selected.
Source credentials are removed before CLI/Docker commands, SQL is sent on stdin,
and all database output is captured. Never print restored rows or raw diagnostics.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import uuid


class ProbeError(RuntimeError):
    pass


IDENTIFIER = r"[a-z_][a-z0-9_]*"
COPY = re.compile(r'^COPY "(' + IDENTIFIER + r')"\."(' + IDENTIFIER + r')" \((.+)\) FROM stdin;$')
EXTENSION = re.compile(r'^CREATE EXTENSION IF NOT EXISTS "([a-z_][a-z0-9_-]*)"(?: WITH SCHEMA "(' + IDENTIFIER + r')")?;$', re.M)


def row_digest(rows):
    digest = hashlib.sha256()
    for row in sorted(rows):
        digest.update(row.encode("utf8"))
        digest.update(b"\n")
    return digest.hexdigest()


def copy_tables(text, *, allow_empty=False):
    tables = {}
    active = None
    rows = []
    for line in text.split("\n"):
        if active:
            if line == r"\.":
                tables[active[0]] = {"columns": active[1], "count": len(rows), "digest": row_digest(rows)}
                active, rows = None, []
            else:
                rows.append(line)
        elif line.startswith("COPY "):
            match = COPY.fullmatch(line)
            if not match:
                raise ProbeError("Unsupported COPY syntax in recovery file")
            schema, table, columns = match.groups()
            if not re.fullmatch(r'"' + IDENTIFIER + r'"(?:, "' + IDENTIFIER + r'")*', columns):
                raise ProbeError("Unsupported COPY column list")
            key = (schema, table)
            if key in tables:
                raise ProbeError("Duplicate COPY block")
            active = (key, columns)
    if active:
        raise ProbeError("Incomplete COPY block")
    if not tables and not allow_empty:
        raise ProbeError("No COPY records found in recovery data")
    return tables


def local_environment(source):
    forbidden = ("BACKUP_", "RESTIC_", "RCLONE_", "SUPABASE_", "PG")
    result = {k: v for k, v in source.items() if not k.startswith(forbidden)}
    for key in ["DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH", "GITHUB_TOKEN", "GH_TOKEN", "ACTIONS_RUNTIME_TOKEN"]:
        result.pop(key, None)
    return result


def configure(text, project):
    if not re.fullmatch(r"vintazhka-restore-[a-f0-9]{12}", project):
        raise ProbeError("Invalid disposable project identity")
    text, changed = re.subn(r'^project_id\s*=.*$', 'project_id = "' + project + '"', text, count=1, flags=re.M)
    if changed != 1:
        raise ProbeError("Cannot configure disposable project")
    for section in ["api", "auth", "storage", "realtime", "studio", "inbucket", "edge_runtime", "analytics", "db.migrations", "db.seed"]:
        pattern = r'(^\[' + re.escape(section) + r'\][^\n]*\n)(.*?)(?=^\[|\Z)'
        def disable(match):
            body, count = re.subn(r'^enabled[ \t]*=[ \t]*true[ \t]*$', 'enabled = false', match[2], count=1, flags=re.M)
            if count != 1 and not re.search(r'^enabled[ \t]*=[ \t]*false[ \t]*$', body, re.M):
                raise ProbeError("Unsupported local CLI configuration")
            return match[1] + body
        text, count = re.subn(pattern, disable, text, count=1, flags=re.M | re.S)
        if count != 1:
            raise ProbeError("Missing local service configuration")
    if not re.search(r'^major_version\s*=\s*17\s*$', text, re.M):
        raise ProbeError("Recovery test requires PostgreSQL 17")
    return text


def extension_sql(schema):
    result = []
    for match in EXTENSION.finditer(schema):
        name, namespace = match.groups()
        if namespace:
            result.append(f'CREATE SCHEMA IF NOT EXISTS "{namespace}";')
        result.append(match[0])
    return "\n".join(result)


def platform_references(sql):
    """Metadata only: roles/publications normally provided by managed Supabase."""
    role = r'"(' + IDENTIFIER + r')"'
    roles = set()
    for prefix in [r'OWNER TO ', r'FOR ROLE ', r'GRANTED BY ', r'SET ROLE ']:
        roles.update(re.findall(prefix + role, sql))
    for line in sql.split("\n"):
        if re.match(r'^(GRANT|REVOKE|CREATE POLICY|ALTER DEFAULT PRIVILEGES)\b', line):
            match = re.search(r'\b(?:TO|FROM)\s+((?:"' + IDENTIFIER + r'"(?:,\s*)?)+)', line)
            if match:
                roles.update(re.findall(role, match[1]))
    defined = set(re.findall(r'^CREATE ROLE ' + role + r';', sql, re.M))
    publications = set(re.findall(r'^ALTER PUBLICATION ' + role, sql, re.M))
    if len(roles) > 256 or len(publications) > 256:
        raise ProbeError("Unexpected platform metadata inventory")
    return roles - defined, publications


def probe(bundle, work, invoke, *, env=None):
    required = ["roles.sql", "schema.sql", "restore-schema.sql", "data.sql", "history-schema.sql", "history-data.sql"]
    database = bundle / "database"
    if not all((database / f).is_file() for f in required):
        raise ProbeError("Snapshot needs a fresh backup with the unified recovery schema")
    expected = copy_tables((database / "data.sql").read_text())
    history = copy_tables((database / "history-data.sql").read_text(), allow_empty=True)
    if expected.keys() & history.keys():
        raise ProbeError("Duplicate migration-history copy")
    expected.update(history)
    if ("public", "products") not in expected or ("auth", "users") not in expected:
        raise ProbeError("Recovery data must include products and Auth accounts")
    project = "vintazhka-restore-" + uuid.uuid4().hex[:12]
    container = "supabase_db_" + project
    local = work / project
    local.mkdir(mode=0o700)
    child_env = local_environment(env if env is not None else os.environ)
    docker = ["docker", "--host=unix:///var/run/docker.sock"]
    cli = ["supabase", "--workdir", str(local)]

    def command(args, **kwargs):
        return invoke(args, env=child_env, **kwargs)

    def psql(sql):
        return command([*docker, "exec", "-i", container, "sh", "-c",
                        'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql "$@"', "restore-probe",
                        "-X", "--quiet", "--no-align", "--tuples-only",
                        "--set=ON_ERROR_STOP=1", "--set=VERBOSITY=verbose", "-U", "supabase_admin", "-d", "postgres"], stdin_text=sql)

    def disconnected():
        state = command([*docker, "inspect", container], json_output=True)
        if not isinstance(state, list) or len(state) != 1 or state[0].get("Name") != "/" + container:
            raise ProbeError("Disposable database identity mismatch")
        return state[0].get("NetworkSettings", {}).get("Networks", {})

    print("restore_probe: preparing a new temporary local database", flush=True)
    try:
        command([*cli, "init", "--yes"], timeout=120)
        config = local / "supabase/config.toml"
        config.write_text(configure(config.read_text(), project))
        command([*cli, "db", "start"], timeout=900)
        for name in disconnected():
            command([*docker, "network", "disconnect", "--force", name, container])
        if disconnected():
            raise ProbeError("Recovery database still has a network connection")
        print("restore_probe: network disconnected; importing inside the temporary container", flush=True)
        # CLI schema dumps omit platform CREATE ROLE / CREATE PUBLICATION lines,
        # but keep ownership, grants and ALTER PUBLICATION table memberships.
        # Provide missing inert platform objects ONLY in this disconnected target.
        source_metadata = (database / "roles.sql").read_text() + "\n" + (database / "restore-schema.sql").read_text()
        needed_roles, needed_publications = platform_references(source_metadata)
        existing_roles = set(json.loads(psql("SELECT coalesce(json_agg(rolname),'[]'::json) FROM pg_roles;\n")))
        existing_publications = set(json.loads(psql("SELECT coalesce(json_agg(pubname),'[]'::json) FROM pg_publication;\n")))
        for name in sorted(needed_roles - existing_roles):
            psql(f'CREATE ROLE "{name}" NOLOGIN NOSUPERUSER NOBYPASSRLS;\n')
        for name in sorted(needed_publications - existing_publications):
            psql(f'CREATE PUBLICATION "{name}";\n')
        # All DDL/DML below targets only the newly created, disconnected container.
        sql = "BEGIN;\nSET session_replication_role = replica;\nSET check_function_bodies = false;\n"
        sql += (database / "roles.sql").read_text() + "\n"
        for namespace in ["public", "vh_private", "auth", "storage", "supabase_migrations"]:
            sql += f'DROP SCHEMA IF EXISTS "{namespace}" CASCADE;\n'
        sql += extension_sql((database / "schema.sql").read_text()) + "\n"
        for name in ["restore-schema.sql", "data.sql", "history-schema.sql", "history-data.sql"]:
            sql += (database / name).read_text() + "\n"
        sql += "COMMIT;\n"
        psql(sql)
        verified_rows = 0
        for (schema, table), expected_table in sorted(expected.items()):
            actual = psql('SET timezone = \'UTC\'; SET extra_float_digits = 3; SET DateStyle = \'ISO, MDY\'; '
                          f'COPY (SELECT {expected_table["columns"]} FROM "{schema}"."{table}") TO STDOUT;\n')
            rows = actual.split("\n")
            if rows and rows[-1] == "":
                rows.pop()
            if len(rows) != expected_table["count"] or row_digest(rows) != expected_table["digest"]:
                raise ProbeError("Restored table contents differ from the snapshot (" + schema + "." + table + ")")
            verified_rows += len(rows)
        # Check that an unauthenticated buyer cannot read orders after restore.
        if ("public", "orders") in expected:
            allowed = psql("SELECT has_table_privilege('anon','public.orders','SELECT');\n").strip()
            if allowed == "t" and psql("SET ROLE anon; SELECT count(*) FROM public.orders;\n").strip() != "0":
                raise ProbeError("Anonymous order access was not isolated after restore")
        if disconnected():
            raise ProbeError("Recovery network isolation was lost")
        return {"full_database_restore_verified": True, "restore_target": "temporary-network-disconnected-postgres-17",
                "tables_verified": len(expected), "rows_verified": verified_rows,
                "external_services_reconfigured": False, "production_database_modified": False}
    finally:
        try:
            command([*cli, "stop", "--project-id", project, "--no-backup", "--yes"], timeout=120)
        except Exception:
            # The runner is ephemeral; never target other projects or use --all.
            print("restore_probe: cleanup requires checking this disposable runner", flush=True)
