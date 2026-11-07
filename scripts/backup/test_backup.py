import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib.parse import unquote, urlsplit

import run as backup


class BackupGuards(unittest.TestCase):
    def test_stale_unlock_is_scoped_to_verified_repository(self):
        expected = "a" * 64
        with patch.dict(os.environ, {"BACKUP_REPOSITORY_ID": expected}), patch.object(backup, "call") as command:
            command.return_value = {"id": expected}
            backup.prepare_backup_repository({"fixture": "env"})
            self.assertEqual(command.call_args_list[0].args[0], ["restic", "cat", "config"])
            self.assertEqual(command.call_args_list[1].args[0], ["restic", "unlock"])
            self.assertEqual(command.call_count, 2)
            command.reset_mock()
            command.return_value = {"id": "b" * 64}
            with self.assertRaises(backup.BackupError):
                backup.prepare_backup_repository({})
            self.assertEqual(command.call_count, 1)

    def test_lock_errors_name_only_safe_operation(self):
        completed = subprocess.CompletedProcess([], 11, "PRIVATE-DATA", "secret-password and lock owner")
        with patch.object(backup.subprocess, "run", return_value=completed):
            with self.assertRaises(backup.BackupError) as caught:
                backup.call(["restic", "restore", "private-snapshot"])
        self.assertIn("restic restore", str(caught.exception))
        self.assertIn("exit 11", str(caught.exception))
        for sensitive in ["PRIVATE", "secret", "private-snapshot", "lock owner"]:
            self.assertNotIn(sensitive, str(caught.exception))

    def test_separate_database_password_encodes_special_characters(self):
        ref = backup.CONFIG["project_ref"]
        template = f"postgresql://postgres.{ref}:[YOUR-PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
        password = "synthetic:@#?%[] /пароль"
        with patch.dict(os.environ, {"BACKUP_DATABASE_URL": template, "BACKUP_DATABASE_PASSWORD": password}, clear=True):
            actual = backup.database_url()
            self.assertEqual(unquote(urlsplit(actual).password), password)
            self.assertEqual(urlsplit(actual).hostname, "aws-1-eu-west-1.pooler.supabase.com")

    def test_database_template_must_not_silently_use_another_password(self):
        ref = backup.CONFIG["project_ref"]
        uri = f"postgresql://postgres.{ref}:old@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
        with patch.dict(os.environ, {"BACKUP_DATABASE_URL": uri, "BACKUP_DATABASE_PASSWORD": "new"}, clear=True):
            with self.assertRaises(backup.BackupError):
                backup.database_url()
        with patch.dict(os.environ, {"BACKUP_DATABASE_URL": uri}, clear=True):
            self.assertEqual(backup.database_url(), uri)

    def test_database_check_uses_schema_only_without_other_credentials(self):
        ref = backup.CONFIG["project_ref"]
        values = {"BACKUP_DATABASE_URL": f"postgresql://postgres.{ref}:[YOUR-PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres",
                  "BACKUP_DATABASE_PASSWORD": "fixture-password"}
        with tempfile.TemporaryDirectory() as temporary, patch.dict(os.environ, values, clear=True):
            directory = Path(temporary)
            def dump(args, **kwargs):
                self.assertEqual(args[:3], ["supabase", "db", "dump"])
                self.assertEqual(args[-2:], ["--schema", "public"])
                self.assertNotIn("--data-only", args)
                Path(args[args.index("--file") + 1]).write_text("CREATE TABLE fixture(id int);")
                return ""
            with patch.object(backup, "call", side_effect=dump) as command:
                result = backup.check_database(directory, dict(os.environ))
            self.assertEqual(command.call_count, 1)
            self.assertTrue(result["database_connection_verified"])
            self.assertFalse(result["source_mutations"])
            self.assertEqual((directory / "connection-check.sql").stat().st_mode & 0o777, 0o600)

    def test_session_connection_is_scoped_and_transaction_pooler_is_rejected(self):
        ref = backup.CONFIG["project_ref"]
        good = f"postgresql://postgres.{ref}:fixture@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
        self.assertEqual(backup.validate_database_url(good), good)
        for bad in [good.replace(":5432", ":6543"), good.replace(ref, "another-project"),
                    good.replace(".pooler.supabase.com", ".evil.example"), good.replace("postgresql:", "http:"),
                    good.replace("/postgres", "/another"), good.replace(":fixture@", "@")]:
            with self.subTest(value=bad):
                with self.assertRaises(backup.BackupError):
                    backup.validate_database_url(bad)

    def test_object_keys_cannot_escape_or_add_files_from_entries(self):
        for key in ["../file", "bucket/../../file", "/bucket/file", "bucket//file", "bucket/a\nother", "bucket/a\\file", "bucket/./file"]:
            with self.subTest(key=key):
                with self.assertRaises(backup.BackupError):
                    backup.key_path(key)
        self.assertEqual(str(backup.key_path("bucket/українська назва.webp")), "bucket/українська назва.webp")

    def test_inventory_rejects_duplicates_and_objects_without_fingerprints(self):
        row = {"Path": "bucket/file", "Size": 5, "ModTime": "2026-11-01T00:00:00Z", "Hashes": {}}
        with self.assertRaises(backup.BackupError):
            backup.inventory([row, row])
        with self.assertRaises(backup.BackupError):
            backup.inventory([{**row, "ModTime": "0001-01-01T00:00:00Z"}])
        with self.assertRaises(backup.BackupError):
            backup.inventory([{**row, "Size": -1}])

    def test_same_size_replacement_is_detected_by_hash(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "bucket").mkdir()
            (directory / "bucket/file").write_bytes(b"same")
            old = {"bucket/file": {"size": 4, "mtime": "fixed", "hashes": {"md5": "old"}}}
            new = {"bucket/file": {"size": 4, "mtime": "fixed", "hashes": {"md5": "new"}}}
            self.assertEqual(backup.changed_objects(old, old, directory), [])
            self.assertEqual(backup.changed_objects(new, old, directory), ["bucket/file"])
            (directory / "bucket/file").unlink()
            self.assertEqual(backup.changed_objects(old, old, directory), ["bucket/file"])

    def test_cli_diagnostics_do_not_disclose_secrets(self):
        completed = subprocess.CompletedProcess(["fixture"], 1, "SENSITIVE_SQL", "secret-password")
        with patch.object(backup.subprocess, "run", return_value=completed):
            with self.assertRaises(backup.BackupError) as caught:
                backup.call(["fixture", "secret-in-argv"])
        self.assertNotIn("secret", str(caught.exception))
        self.assertNotIn("SENSITIVE", str(caught.exception))

    def test_retention_cannot_run_before_controlled_restore(self):
        with patch.dict(os.environ, {"BACKUP_RESTORE_VERIFIED": "false"}), patch.object(backup, "call") as command:
            with self.assertRaises(backup.BackupError):
                backup.retention({})
            command.assert_not_called()

    def test_manifest_json_named_asset_is_still_verified(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            asset = directory / "media/bucket/manifest.json"
            asset.parent.mkdir(parents=True)
            asset.write_text('{"photo-metadata":"fixture"}')
            marker = backup.make_manifest(directory, {}, 0)
            self.assertIn("media/bucket/manifest.json", marker["files"])
            asset.write_text("corrupt")
            with self.assertRaises(backup.BackupError):
                backup.validate_bundle(directory)

    def test_drive_credentials_are_private_and_removed_after_use(self):
        values = {"BACKUP_DRIVE_TOKEN": '{"refresh_token":"private-fixture"}', "RESTIC_PASSWORD": "fixture-strong-password-for-test"}
        with tempfile.TemporaryDirectory() as temporary, patch.dict(os.environ, values):
            directory = Path(temporary)
            with backup.credentials(directory) as env:
                file = Path(env["RCLONE_CONFIG"])
                self.assertEqual(file.stat().st_mode & 0o777, 0o600)
                self.assertIn(backup.CONFIG["drive_folder_id"], file.read_text())
                self.assertNotIn("storage", file.read_text())
            self.assertFalse(file.exists())

    def test_restored_path_may_not_traverse_a_symlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "outside").mkdir()
            (directory / "inside").mkdir()
            (directory / "inside/code").symlink_to(directory / "outside", target_is_directory=True)
            with self.assertRaises(backup.BackupError):
                backup.safe_file(directory / "inside", "code/file")


@unittest.skipUnless(shutil.which("restic"), "Install the checksum-pinned Restic test binary")
class EncryptedRoundTrip(unittest.TestCase):
    def test_active_lock_survives_and_abandoned_lock_is_recovered(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            env = {**os.environ, "RESTIC_REPOSITORY": str(root / "repository"),
                   "RESTIC_PASSWORD": "synthetic-lock-test-only", "RESTIC_CACHE_DIR": str(root / "cache")}
            backup.call(["restic", "init", "--repository-version", "2"], env=env)
            identity = backup.call(["restic", "cat", "config"], env=env, json_output=True)["id"]
            process = subprocess.Popen(["restic", "backup", "--stdin", "--stdin-filename", "fixture"],
                                       env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                deadline = time.monotonic() + 12
                while not list((root / "repository/locks").glob("*")) and time.monotonic() < deadline:
                    if process.poll() is not None:
                        self.fail("Synthetic lock holder exited early")
                    time.sleep(.05)
                locks = set((root / "repository/locks").glob("*"))
                self.assertTrue(locks, "Synthetic backup did not acquire a lock")
                with patch.dict(os.environ, {"BACKUP_REPOSITORY_ID": identity}):
                    backup.prepare_backup_repository(env)
                self.assertEqual(set((root / "repository/locks").glob("*")), locks, "An active lock was removed")
                process.kill()
                process.communicate(timeout=10)
                self.assertEqual(set((root / "repository/locks").glob("*")), locks)
                with patch.dict(os.environ, {"BACKUP_REPOSITORY_ID": identity}):
                    backup.prepare_backup_repository(env)
                self.assertEqual(list((root / "repository/locks").glob("*")), [])
                source = root / "source"
                source.mkdir()
                (source / "fixture.txt").write_text("synthetic recovery verified")
                backup.call(["restic", "backup", "."], cwd=source, env=env)
                saved = backup.call(["restic", "snapshots", "--json"], env=env, json_output=True)[-1]
                backup.restore_bundle(saved, root / "restored", env)
                self.assertEqual((root / "restored/fixture.txt").read_text(), "synthetic recovery verified")
            finally:
                if process.poll() is None:
                    process.kill()
                    process.communicate(timeout=10)

    def test_incremental_capture_deletion_and_old_version_recovery(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            env = {**os.environ, "RESTIC_REPOSITORY": str(root / "repository"), "RESTIC_PASSWORD": "test-only-strong-password", "RESTIC_CACHE_DIR": str(root / "cache")}
            backup.call(["restic", "init", "--repository-version", "2"], env=env)
            repository_id = backup.call(["restic", "cat", "config"], env=env, json_output=True)["id"]
            source = root / "source"
            (source / "bucket").mkdir(parents=True)
            original = b"synthetic private old photograph content " * 200
            replacement = b"synthetic private new photograph content " * 200
            self.assertEqual(len(original), len(replacement))
            (source / "bucket/a.webp").write_bytes(original)
            (source / "bucket/b.webp").write_bytes(b"second image")
            downloaded = []
            real_call = backup.call

            def listing(env):
                return backup.inventory([{"Path": file.relative_to(source).as_posix(), "Size": file.stat().st_size,
                    "ModTime": "2026-11-01T00:00:00Z", "Hashes": {"md5": hashlib.md5(file.read_bytes()).hexdigest()}}
                    for file in sorted(source.rglob("*")) if file.is_file()])

            def commands(args, **kwargs):
                if args[:3] == ["rclone", "copy", "storage:"]:
                    target = Path(args[3])
                    files = Path(args[args.index("--files-from-raw") + 1]).read_text().splitlines()
                    for key in files:
                        destination = target / key
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(source / key, destination)
                    downloaded.extend(files)
                    return ""
                return real_call(args, **kwargs)

            def database(directory, env):
                (directory / "database").mkdir(exist_ok=True)
                (directory / "database/data.sql").write_text("CREATE TABLE products(id int, price int, measurements jsonb);\nINSERT INTO products VALUES (1,500,'{\"length\":60}');\n")

            def functions(directory, env):
                (directory / "deployed-functions").mkdir(exist_ok=True)
                backup.write_json(directory / "deployed-functions/inventory.json", [])

            with patch.dict(os.environ, {"BACKUP_REPOSITORY_ID": repository_id}), \
                 patch.object(backup, "storage_listing", side_effect=listing), \
                 patch.object(backup, "call", side_effect=commands), \
                 patch.object(backup, "export_database", side_effect=database), \
                 patch.object(backup, "export_functions", side_effect=functions):
                first_work = root / "run1"
                first_work.mkdir()
                first = backup.backup(first_work, env)
                self.assertEqual(first["changed_media_files"], 2)
                self.assertEqual(downloaded, ["bucket/a.webp", "bucket/b.webp"])
                downloaded.clear()
                second_work = root / "run2"
                second_work.mkdir()
                second = backup.backup(second_work, env)
                self.assertEqual(second["changed_media_files"], 0)
                self.assertEqual(downloaded, [])
                self.assertTrue(second["encrypted_restore_verified"])
                self.assertFalse(second["full_database_restore_verified"])
                (source / "bucket/a.webp").write_bytes(replacement)
                (source / "bucket/b.webp").unlink()
                (source / "bucket/c.webp").write_bytes(b"new image")
                third_work = root / "run3"
                third_work.mkdir()
                third = backup.backup(third_work, env)
                self.assertEqual(third["changed_media_files"], 2)
                self.assertEqual(downloaded, ["bucket/a.webp", "bucket/c.webp"])
                saved = {s["id"]: s for s in backup.snapshots(env)}
                old_restore = root / "old-restore"
                backup.restore_bundle(saved[first["snapshot_id"]], old_restore, env)
                backup.validate_bundle(old_restore)
                self.assertEqual((old_restore / "media/bucket/a.webp").read_bytes(), original)
                self.assertTrue((old_restore / "media/bucket/b.webp").exists())
                self.assertFalse((old_restore / "media/bucket/c.webp").exists())
                new_restore = root / "new-restore"
                backup.restore_bundle(saved[third["snapshot_id"]], new_restore, env)
                self.assertEqual((new_restore / "media/bucket/a.webp").read_bytes(), replacement)
                self.assertFalse((new_restore / "media/bucket/b.webp").exists())
                (new_restore / "media/bucket/a.webp").write_bytes(b"corrupted")
                with self.assertRaises(backup.BackupError):
                    backup.validate_bundle(new_restore)
                wrong_env = {**env, "RESTIC_PASSWORD": "wrong-password"}
                with self.assertRaises(backup.BackupError):
                    backup.verify_repository(wrong_env)
            real_call(["restic", "check", "--read-data"], env=env)
            for file in (root / "repository/data").rglob("*"):
                if file.is_file():
                    self.assertNotIn(original, file.read_bytes(), "Repository must not contain plaintext media")


if __name__ == "__main__":
    unittest.main()
