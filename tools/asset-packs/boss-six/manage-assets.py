"""Import approved boss-6 PNGs and validate the complete sprite set."""
import argparse
from io import BytesIO
import json
from pathlib import Path
import sys
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ASSET_ROOT = ROOT / "apps/space-dominators/assets/sprites"
MANIFEST = ASSET_ROOT / "manifest.json"


def validate(data, entry):
    with Image.open(BytesIO(data)) as image:
        image.load()
        if image.format != "PNG":
            raise ValueError("Expected PNG")
        if image.size != tuple(entry["size"]):
            raise ValueError(f"Expected {entry['size']}, got {image.size}")
        if "A" not in image.getbands() and "transparency" not in image.info:
            raise ValueError("No transparency channel")
        rgba = image.convert("RGBA")
        alpha = rgba.getchannel("A")
        lo, hi = alpha.getextrema()
        if lo != 0 or hi == 0:
            raise ValueError("Need transparent padding and visible sprite pixels")
        width, height = image.size
        corners = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
        if any(alpha.getpixel(point) != 0 for point in corners):
            raise ValueError("Corners must be fully transparent")
        bounds = alpha.getbbox()
        if entry.get("repeatAxis") == "y":
            if rgba.crop((0, 0, width, 1)).tobytes() != rgba.crop((0, height-1, width, height)).tobytes():
                raise ValueError("Laser first and last rows must match")
        elif bounds[0] == 0 or bounds[1] == 0 or bounds[2] == width or bounds[3] == height:
            raise ValueError("Sprite touches canvas edge; add transparent padding")
        return {"bytes": len(data), "alphaBounds": bounds}


def check(entries):
    missing, invalid = [], []
    total = 0
    for entry in entries:
        path = ASSET_ROOT / entry["path"]
        if not path.is_file():
            missing.append(entry["path"])
            continue
        try:
            result = validate(path.read_bytes(), entry)
            total += result["bytes"]
            print(f"OK       {entry['path']}")
        except (ValueError, OSError, Image.DecompressionBombError) as error:
            invalid.append(entry["path"])
            print(f"INVALID  {entry['path']} - {error}")
    for path in missing:
        print(f"MISSING  {path}")
    print(f"Valid {len(entries)-len(missing)-len(invalid)}/{len(entries)}; "
          f"missing {len(missing)}; invalid {len(invalid)}; {total:,} bytes")
    return 1 if missing or invalid else 0


def import_assets(source, entries, replace):
    allowed = {Path(entry["path"]).name: entry for entry in entries}
    candidates = {}
    ignored = []

    def add(name, data):
        if name in candidates:
            raise ValueError(f"Duplicate asset name in source: {name}")
        validate(data, allowed[name])
        destination = ASSET_ROOT / allowed[name]["path"]
        if destination.exists() and destination.read_bytes() != data and not replace:
            raise ValueError(f"Already exists: {destination}. Use --replace after review.")
        candidates[name] = data

    if source.is_dir():
        for path in sorted(source.rglob("*.png")):
            if path.name in allowed:
                add(path.name, path.read_bytes())
            else:
                ignored.append(path.name)
    elif source.is_file() and zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            for info in archive.infolist():
                name = info.filename.replace(chr(92), "/").rsplit("/", 1)[-1]
                if info.is_dir():
                    continue
                if name not in allowed:
                    ignored.append(name)
                    continue
                if info.file_size > 16 * 1024 * 1024:
                    raise ValueError(f"Asset exceeds 16 MiB: {name}")
                add(name, archive.read(info))
    else:
        raise ValueError("Source must be a ZIP file or a directory")
    if not candidates:
        raise ValueError("No approved asset filename found")
    # Validate the entire incoming batch before writing any of it.
    for name, data in candidates.items():
        destination = ASSET_ROOT / allowed[name]["path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        print(f"IMPORTED {destination.relative_to(ROOT)}")
    if ignored:
        print("Ignored extra files: " + ", ".join(ignored))
    check(entries)
    print("Import complete. Run check after importing every group.")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check")
    importer = commands.add_parser("import")
    importer.add_argument("--source", required=True, type=Path)
    importer.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    entries = json.loads(MANIFEST.read_text(encoding="utf-8"))["assets"]
    try:
        if args.command == "check":
            return check(entries)
        return import_assets(args.source.expanduser().resolve(), entries, args.replace)
    except (ValueError, OSError, zipfile.BadZipFile, Image.DecompressionBombError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
