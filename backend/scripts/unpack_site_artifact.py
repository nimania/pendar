"""Accept both historical flat site artifacts and current tar artifacts."""
import sys
import tarfile
from pathlib import Path

def unpack(folder):
    folder = Path(folder)
    archive = folder / "latest-static-site.tar"
    if archive.is_file():
        with tarfile.open(archive) as tar:
            tar.extractall(folder, filter="data")
        archive.unlink()

if __name__ == "__main__":
    unpack(sys.argv[1])
