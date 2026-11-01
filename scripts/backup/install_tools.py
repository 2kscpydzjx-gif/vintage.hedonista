"""Install exact upstream releases; verify the downloaded bytes before execution."""
import argparse
import bz2
import hashlib
import io
import os
from pathlib import Path
import tarfile
import urllib.request
import zipfile

TOOLS = {
    "restic": (
        "https://github.com/restic/restic/releases/download/v0.19.1/restic_0.19.1_linux_amd64.bz2",
        "f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c", "bz2", None),
    "rclone": (
        "https://github.com/rclone/rclone/releases/download/v1.75.2/rclone-v1.75.2-linux-amd64.zip",
        "349ac8fba6ff65d6247043f1750cdcb518ec5d500ef91463a10d37c0ccdf3702", "zip",
        "rclone-v1.75.2-linux-amd64/rclone"),
    "supabase": (
        "https://github.com/supabase/cli/releases/download/v2.81.0/supabase_linux_amd64.tar.gz",
        "40308473f1f350c368073b74bd96ac1cc9e0b39be4faf20fd6a5bdde1242398d", "tar", "supabase"),
}


def install(directory, names):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    for name in names:
        url, expected, kind, member = TOOLS[name]
        with urllib.request.urlopen(url, timeout=90) as response:
            data = response.read(150_000_000)
        if hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError(f"Checksum mismatch: {name}")
        if kind == "bz2":
            binary = bz2.decompress(data)
        elif kind == "zip":
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                binary = archive.read(member)
        else:
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
                item = next((m for m in archive.getmembers() if m.name.lstrip("./") == member and m.isfile()), None)
                if item is None:
                    raise RuntimeError("Missing binary in verified archive")
                binary = archive.extractfile(item).read()
        destination = directory / name
        destination.write_bytes(binary)
        os.chmod(destination, 0o700)
        print(f"Installed verified {name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", required=True, type=Path)
    parser.add_argument("--tools", nargs="+", choices=TOOLS, default=list(TOOLS))
    args = parser.parse_args()
    install(args.directory, args.tools)
