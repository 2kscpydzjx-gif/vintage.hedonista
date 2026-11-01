"""Read-only source backup. The only remote writes are to the private Drive repository.

No credentials or subprocess diagnostics are printed. Production imports, migrations,
notifications and restores are deliberately absent from this program.
"""
import argparse
from contextlib import contextmanager
import configparser
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((ROOT / "scripts/backup/config.json").read_text())
TAG = "project:" + CONFIG["project_ref"]


class BackupError(RuntimeError):
    pass


def call(args, *, cwd=None, env=None, json_output=False, timeout=1800, stdin_text=None):
    """Keep CLI errors, which may contain credentials, filenames or SQL, out of logs."""
    try:
        result = subprocess.run(args, cwd=cwd, env=env, input=stdin_text, text=True, capture_output=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        raise BackupError(f"{Path(args[0]).name}: unavailable or timed out") from None
    if result.returncode:
        diagnostic = (result.stdout + result.stderr).lower()
        if "password authentication failed" in diagnostic or "sasl auth failed" in diagnostic:
            raise BackupError("Database authentication failed: check BACKUP_DATABASE_PASSWORD")
        state = re.search(r'ERROR:\s+([0-9A-Z]{5})\b', result.stderr)
        if state:
            raise BackupError("Isolated SQL operation failed (SQLSTATE " + state[1] + ")")
        raise BackupError(f"{Path(args[0]).name}: command failed (exit {result.returncode}); no backup marked complete")
    if json_output:
        try:
            return json.loads(result.stdout)
        except ValueError:
            raise BackupError(f"{Path(args[0]).name}: invalid JSON response") from None
    return result.stdout


def require(name):
    value = os.environ.get(name, "")
    if not value or "\n" in value or "\r" in value:
        raise BackupError(f"Missing or malformed secret: {name}")
    return value


def validate_database_url(value, project=CONFIG["project_ref"]):
    try:
        parsed = urlsplit(value)
        port = parsed.port or 5432
    except ValueError:
        raise BackupError("Malformed database connection") from None
    direct = parsed.hostname == f"db.{project}.supabase.co" and parsed.username == "postgres"
    pooler = bool(re.fullmatch(r"aws-[\w-]+\.pooler\.supabase\.com", parsed.hostname or "")) and parsed.username == f"postgres.{project}"
    if parsed.scheme not in ("postgres", "postgresql") or not (direct or pooler) or port != 5432 or parsed.path != "/postgres" or not parsed.password or parsed.fragment:
        raise BackupError("Use this project's direct or SESSION pooler URL on port 5432")
    return value


def database_url():
    value = require("BACKUP_DATABASE_URL")
    if os.environ.get("BACKUP_DATABASE_PASSWORD"):
        password = require("BACKUP_DATABASE_PASSWORD")
        if value.count("[YOUR-PASSWORD]") != 1:
            raise BackupError("With a separate password, keep [YOUR-PASSWORD] in the connection template")
        value = value.replace("[YOUR-PASSWORD]", quote(password, safe=""))
    elif "[YOUR-PASSWORD]" in value:
        raise BackupError("Missing secret: BACKUP_DATABASE_PASSWORD")
    return validate_database_url(value)


def check_database(directory, env):
    output = directory / "connection-check.sql"
    call(["supabase", "db", "dump", "--db-url", database_url(), "--file", str(output), "--schema", "public"], env=env)
    if not output.is_file() or not output.stat().st_size:
        raise BackupError("Database check returned an empty schema export")
    os.chmod(output, 0o600)
    return {"database_connection_verified": True, "schema_export_verified": True, "source_mutations": False}


def key_path(value):
    if not isinstance(value, str) or not value or "\\" in value or any(ord(c) < 32 for c in value):
        raise BackupError("Unsupported storage object path")
    parts = value.split("/")
    if len(parts) < 2 or any(p in ("", ".", "..") for p in parts):
        raise BackupError("Unsafe storage object path")
    return PurePosixPath(value)


def inventory(rows):
    if not isinstance(rows, list):
        raise BackupError("Storage listing must be an array")
    objects = {}
    for row in rows:
        if not isinstance(row, dict):
            raise BackupError("Invalid storage inventory record")
        if row.get("IsDir"):
            continue
        key = str(key_path(row.get("Path")))
        size = row.get("Size")
        mtime = row.get("ModTime")
        if key in objects or not isinstance(size, int) or isinstance(size, bool) or size < 0:
            raise BackupError("Invalid or duplicate storage object")
        hashes = row.get("Hashes") or {}
        if not isinstance(hashes, dict):
            raise BackupError("Invalid storage fingerprint")
        digest = {str(k): str(v) for k, v in sorted(hashes.items()) if v}
        if not digest and (not isinstance(mtime, str) or not mtime or mtime.startswith("0001-")):
            raise BackupError("Storage object has no version fingerprint")
        objects[key] = {"size": size, "mtime": mtime, "hashes": digest}
    return objects


def fingerprint(value):
    return (value["size"], value["hashes"] or value["mtime"])


def changed_objects(current, previous, media):
    changed = []
    for key, value in current.items():
        old = previous.get(key)
        candidate = safe_file(media, key)
        if candidate.is_symlink() or (candidate.exists() and not candidate.is_file()):
            raise BackupError("Unexpected filesystem object in media cache")
        if not old or fingerprint(old) != fingerprint(value) or not candidate.is_file() or candidate.stat().st_size != value["size"]:
            changed.append(key)
    return sorted(changed)


def safe_file(directory, key):
    parts = key_path(key).parts
    candidate = directory.joinpath(*parts)
    for parent in [candidate, *candidate.parents]:
        if parent == directory:
            break
        if parent.is_symlink():
            raise BackupError("Symlink in snapshot path")
    return candidate


def sha256(file):
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(file, value):
    file.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n")
    os.chmod(file, 0o600)


@contextmanager
def credentials(directory, *, storage=False):
    token = require("BACKUP_DRIVE_TOKEN")
    try:
        parsed = json.loads(token)
        if not parsed.get("refresh_token"):
            raise ValueError()
    except (ValueError, AttributeError):
        raise BackupError("Drive OAuth token must contain a refresh token") from None
    if len(require("RESTIC_PASSWORD")) < 24:
        raise BackupError("Use a unique encryption password of at least 24 characters")
    config = configparser.ConfigParser(interpolation=None)
    config["drive"] = {"type": "drive", "scope": "drive", "root_folder_id": CONFIG["drive_folder_id"], "token": token}
    if storage:
        config["storage"] = {
            "type": "s3", "provider": "Other", "env_auth": "false",
            "access_key_id": require("BACKUP_STORAGE_ACCESS_KEY"),
            "secret_access_key": require("BACKUP_STORAGE_SECRET_KEY"),
            "endpoint": CONFIG["storage_endpoint"], "region": CONFIG["storage_region"],
            "force_path_style": "true",
        }
    file = directory / "rclone.conf"
    with file.open("w", encoding="utf8") as stream:
        config.write(stream)
    os.chmod(file, 0o600)
    env = {**os.environ, "RCLONE_CONFIG": str(file), "RESTIC_REPOSITORY": "rclone:drive:" + CONFIG["repository_directory"]}
    try:
        yield env
    finally:
        file.unlink(missing_ok=True)


def verify_repository(env):
    expected = require("BACKUP_REPOSITORY_ID")
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise BackupError("Invalid repository ID; initialize once and save its ID")
    actual = call(["restic", "cat", "config"], env=env, json_output=True)
    if actual.get("id") != expected:
        raise BackupError("Repository identity mismatch")


def snapshots(env):
    return call(["restic", "snapshots", "--json", "--host", CONFIG["host"], "--tag", TAG], env=env, json_output=True)


def restore_bundle(snapshot, target, env):
    if not re.fullmatch(r"[0-9a-f]{8,64}", snapshot.get("id", "")) or len(snapshot.get("paths", [])) != 1:
        raise BackupError("Unexpected snapshot format")
    # backup is always called with cwd=snapshot and path='.'. Restic stores that
    # directory's contents at tree root even though snapshot.paths is absolute.
    call(["restic", "restore", snapshot["id"], "--target", str(target), "--verify"], env=env)


def validate_bundle(directory):
    marker = json.loads((directory / "manifest.json").read_text())
    if not isinstance(marker, dict) or marker.get("project_ref") != CONFIG["project_ref"] or marker.get("format") != 1:
        raise BackupError("Snapshot belongs to another project or format")
    if not isinstance(marker.get("files"), dict) or not marker["files"]:
        raise BackupError("Missing snapshot file manifest")
    for key, expected in marker["files"].items():
        if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected):
            raise BackupError("Invalid snapshot checksum")
        path = safe_file(directory, key)
        if path.is_symlink() or not path.is_file() or sha256(path) != expected:
            raise BackupError("Snapshot checksum mismatch")
    return marker


def storage_listing(env):
    return inventory(call(["rclone", "lsjson", "storage:", "--recursive", "--files-only", "--hash"], env=env, json_output=True))


def sync_media(directory, previous, env):
    media = directory / "media"
    media.mkdir(exist_ok=True)
    current = storage_listing(env)
    changed = changed_objects(current, previous, media)
    if changed:
        listing = directory.parent / "changed-files.txt"
        listing.write_text("\n".join(changed) + "\n")
        os.chmod(listing, 0o600)
        try:
            call(["rclone", "copy", "storage:", str(media), "--files-from-raw", str(listing), "--ignore-times", "--transfers", "2"], env=env)
        finally:
            listing.unlink(missing_ok=True)
    for file in media.rglob("*"):
        if file.is_symlink():
            raise BackupError("Symlink in media cache")
        if file.is_file() and file.relative_to(media).as_posix() not in current:
            file.unlink()  # local worktree only; historical remote snapshots remain untouched
    for key, value in current.items():
        file = media.joinpath(*key_path(key).parts)
        if not file.is_file() or file.stat().st_size != value["size"]:
            raise BackupError("Incomplete media copy")
    return current, len(changed)


def export_database(directory, env):
    db_url = database_url()
    database = directory / "database"
    database.mkdir(exist_ok=True)
    commands = [
        ("roles.sql", ["--role-only"]), ("schema.sql", []),
        ("data.sql", ["--data-only", "--use-copy", "--exclude", "storage.buckets_vectors,storage.vector_indexes"]),
        ("history-schema.sql", ["--schema", "supabase_migrations"]),
        ("history-data.sql", ["--schema", "supabase_migrations", "--data-only", "--use-copy"]),
        ("auth-storage-reference.sql", ["--schema", "auth,storage"]),
        ("restore-schema.sql", ["--schema", "public,vh_private,auth,storage"]),
    ]
    # CLI subprocess output is captured, never streamed into Actions logs.
    for name, flags in commands:
        output = database / name
        call(["supabase", "db", "dump", "--db-url", db_url, "--file", str(output), *flags], env=env)
        if not output.is_file() or not output.stat().st_size:
            raise BackupError("Empty database export")
        os.chmod(output, 0o600)


def export_functions(directory, env):
    require("SUPABASE_ACCESS_TOKEN")
    project = CONFIG["project_ref"]
    functions = call(["supabase", "functions", "list", "--project-ref", project, "--output", "json"], env=env, json_output=True)
    if not isinstance(functions, list):
        raise BackupError("Unexpected function inventory")
    destination = directory / "deployed-functions"
    destination.mkdir(exist_ok=True)
    write_json(destination / "inventory.json", functions)
    for function in functions:
        slug = function.get("slug")
        if not isinstance(slug, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,99}", slug):
            raise BackupError("Unexpected function name")
        call(["supabase", "functions", "download", slug, "--project-ref", project, "--use-api"], cwd=destination, env=env)


def make_manifest(directory, inventory_value, changed):
    write_json(directory / "media/inventory.json", inventory_value)
    code = directory / "code"
    code.mkdir(exist_ok=True)
    archive = code / "repository.tar.gz"
    call(["git", "archive", "--format=tar.gz", "-o", str(archive), "HEAD"], cwd=ROOT)
    commit = call(["git", "rev-parse", "HEAD"], cwd=ROOT).strip()
    shutil.copyfile(ROOT / "scripts/backup/RESTORE_UK.md", code / "RESTORE_UK.md")
    hashes = {}
    for file in directory.rglob("*"):
        if file.is_symlink():
            raise BackupError("Symlink in snapshot")
        if file.is_file() and file != directory / "manifest.json":
            hashes[file.relative_to(directory).as_posix()] = sha256(file)
    manifest = {"format": 1, "project_ref": CONFIG["project_ref"], "commit": commit,
                "created_at": datetime.now(timezone.utc).isoformat(), "media_count": len(inventory_value),
                "changed_media_count": changed, "files": hashes,
                "restore_status": "bundle checksums verified; full Supabase restore requires separate controlled test"}
    write_json(directory / "manifest.json", manifest)
    validate_bundle(directory)
    return manifest


def backup(work, env):
    verify_repository(env)
    existing = snapshots(env)
    directory = work / "snapshot"
    directory.mkdir(mode=0o700)
    previous = {}
    if existing:
        latest = max(existing, key=lambda x: x["time"])
        restore_bundle(latest, directory, env)
        validate_bundle(directory)
        previous = json.loads((directory / "media/inventory.json").read_text())
        # Refresh every non-media export. Old function files must not survive a deletion.
        for child in list(directory.iterdir()):
            if child.name != "media":
                shutil.rmtree(child) if child.is_dir() else child.unlink()
    changed_total = 0
    for attempt in range(3):
        current, changed = sync_media(directory, previous, env)
        changed_total += changed
        export_database(directory, env)
        if storage_listing(env) == current:
            break
        previous = current
    else:
        raise BackupError("Storage changed during capture; retry later")
    export_functions(directory, env)
    manifest = make_manifest(directory, current, changed_total)
    response = call(["restic", "backup", "--json", "--host", CONFIG["host"], "--tag", TAG, "--tag", "format:1", "."], cwd=directory, env=env)
    summaries = [json.loads(line) for line in response.splitlines() if line.strip()]
    summary = next((s for s in reversed(summaries) if s.get("message_type") == "summary" and s.get("snapshot_id")), None)
    if not summary:
        raise BackupError("No completed snapshot returned")
    call(["restic", "check"], env=env)
    # Test retrieval of this exact encrypted snapshot, not merely archive creation.
    completed = next((s for s in snapshots(env) if s["id"] == summary["snapshot_id"]), None)
    if not completed:
        raise BackupError("Completed snapshot cannot be found")
    restored = work / "verified-restore"
    restore_bundle(completed, restored, env)
    validate_bundle(restored)
    return {"snapshot_id": summary["snapshot_id"], "media_files": manifest["media_count"], "changed_media_files": changed_total,
            "encrypted_restore_verified": True, "full_database_restore_verified": False}


def retention(env):
    if os.environ.get("BACKUP_RESTORE_VERIFIED") != "true":
        raise BackupError("Retention remains disabled until a full controlled restore is verified")
    if not snapshots(env):
        raise BackupError("No snapshots: retention refused")
    call(["restic", "check"], env=env)
    keep = CONFIG["retention"]
    call(["restic", "forget", "--host", CONFIG["host"], "--tag", TAG, "--group-by", "host,tags",
          "--keep-daily", str(keep["daily"]), "--keep-weekly", str(keep["weekly"]), "--keep-monthly", str(keep["monthly"]), "--prune"], env=env)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["initialize", "backup", "backup-and-test", "test-restore", "check", "check-database", "retention", "restore-files"])
    parser.add_argument("--snapshot")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix="vintazhka-backup-") as temporary:
        work = Path(temporary)
        if args.mode == "check-database":
            # A schema-only export tests the password without reading customer
            # rows, touching Drive or requiring Storage/API credentials.
            print(json.dumps(check_database(work, dict(os.environ))))
            return
        with credentials(work, storage=args.mode in ("backup", "backup-and-test")) as env:
            if args.mode == "initialize":
                call(["restic", "init", "--repository-version", "2"], env=env)
                result = {"repository_id": call(["restic", "cat", "config"], env=env, json_output=True)["id"]}
            elif args.mode in ("backup", "backup-and-test"):
                result = backup(work, env)
                if args.mode == "backup-and-test":
                    from restore_probe import ProbeError, probe
                    try:
                        result.update(probe(work / "verified-restore", work, call, env=env))
                    except ProbeError as error:
                        raise BackupError(str(error)) from None
                if os.environ.get("BACKUP_RESTORE_VERIFIED") == "true" and datetime.now(timezone.utc).weekday() == 6:
                    retention(env)
                    result["retention_applied"] = True
            else:
                verify_repository(env)
                if args.mode == "test-restore":
                    from restore_probe import ProbeError, probe
                    saved = snapshots(env)
                    if not saved:
                        raise BackupError("No snapshot available for recovery test")
                    target = work / "recovery"
                    restore_bundle(max(saved, key=lambda s: s["time"]), target, env)
                    validate_bundle(target)
                    try:
                        result = probe(target, work, call, env=env)
                    except ProbeError as error:
                        raise BackupError(str(error)) from None
                elif args.mode == "check":
                    call(["restic", "check", "--read-data"], env=env)
                    result = {"full_repository_check": True}
                elif args.mode == "retention":
                    retention(env)
                    result = {"retention_applied": True}
                else:
                    if not args.snapshot or not re.fullmatch(r"[0-9a-f]{8,64}", args.snapshot) or not args.output:
                        raise BackupError("Provide a snapshot ID and a new empty output directory")
                    target = args.output.resolve()
                    if target.exists() and any(target.iterdir()):
                        raise BackupError("Restore output must be empty")
                    selected = [s for s in snapshots(env) if s["id"].startswith(args.snapshot)]
                    if len(selected) != 1:
                        raise BackupError("Snapshot ID must identify exactly one project snapshot")
                    target.mkdir(parents=True, exist_ok=True, mode=0o700)
                    restore_bundle(selected[0], target, env)
                    marker = validate_bundle(target)
                    result = {"files_restored": True, "source_commit": marker["commit"], "database_import_executed": False}
            print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (BackupError, ValueError, KeyError, OSError) as error:
        # Third-party errors can contain credentials; only our fixed messages are safe.
        print(str(error) if isinstance(error, BackupError) else "Backup failed validation or I/O; no success reported", file=sys.stderr)
        sys.exit(1)
