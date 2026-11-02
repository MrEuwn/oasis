"""Download Roboflow Universe datasets and merge them into one YOLO dataset.

    export ROBOFLOW_API_KEY=xxxx
    python cv/fetch_roboflow.py --out cv/dataset \
        libdetect/reading_room_dataset:1 \
        studycafe/studycafe:1 \
        teste-gxtgx/person-chair:1 \
        object-detection-xxfkw/occupied-chair:1 \
        oscarsurajmasterthesis/chair-bytdf:1 \
        nikhil-ravula/chair-detection---library:1

Class policy: everything is mapped onto person / table / chair. Classes that are
not in that set (laptop, cup, ...) are dropped from the label files, so the
merged dataset keeps a single 3-class schema. Check each dataset's licence on
its Universe page before publishing anything trained on it.
"""

import argparse
import io
import json
import os
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

API = "https://api.roboflow.com"
TARGETS = {"person": 0, "people": 0, "human": 0, "table": 1, "desk": 1,
           "dining table": 1, "chair": 2, "seat": 2}


def fetch_zip(slug, version, key, dest):
    url = f"{API}/{slug}/{version}/yolov11?key={key}"
    req = urllib.request.Request(url, headers={"User-Agent": "oasis-cv"})
    with urllib.request.urlopen(req, timeout=120) as res:
        raw = res.read()
        ctype = res.headers.get("content-type", "")
    if "json" in ctype:
        doc = json.loads(raw)
        link = doc.get("export", {}).get("link") or doc.get("link")
        if not link:
            raise SystemExit(f"{slug}: export not ready and no link returned: {doc}")
        with urllib.request.urlopen(link, timeout=300) as res:
            raw = res.read()
    dest.write_bytes(raw)
    return dest


def names_from_zip(zf):
    """Roboflow ships data.yaml or a README with the class list."""
    for name in zf.namelist():
        if name.endswith("data.yaml") or name.endswith("data.yml"):
            text = zf.read(name).decode("utf-8", "replace")
            m = re.search(r"names:\s*\[(.*?)\]", text, re.S)
            if m:
                return [s.strip().strip("'\"") for s in m.group(1).split(",")]
            names, block = [], text.split("names:")[-1]
            for line in block.splitlines():
                mm = re.match(r"\s*-\s*(.+)", line) or re.match(r"\s*\d+:\s*(.+)", line)
                if mm:
                    names.append(mm.group(1).strip().strip("'\""))
            if names:
                return names
    return []


def merge(zf, slug, names, root):
    mapping = {}
    for i, name in enumerate(names):
        key = name.strip().lower()
        if key in TARGETS:
            mapping[i] = TARGETS[key]
    if not mapping:
        print(f"  ! {slug}: none of {names} map to person/table/chair, skipped")
        return 0, 0
    stem = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
    n_img = n_lbl = 0
    for name in zf.namelist():
        if "/images/" not in name or not re.search(r"\.(jpg|jpeg|png)$", name, re.I):
            continue
        split = "val" if "/valid/" in name or "/val/" in name or "/test/" in name else "train"
        img = zf.read(name)
        out_img = root / "images" / split / f"{stem}__{Path(name).name}"
        out_img.parent.mkdir(parents=True, exist_ok=True)
        out_img.write_bytes(img)
        n_img += 1

        lbl_name = re.sub(r"/images/", "/labels/", name)
        lbl_name = re.sub(r"\.(jpg|jpeg|png)$", ".txt", lbl_name, flags=re.I)
        out_lbl = root / "labels" / split / f"{stem}__{Path(name).stem}.txt"
        out_lbl.parent.mkdir(parents=True, exist_ok=True)
        lines = []
        if lbl_name in zf.namelist():
            for line in zf.read(lbl_name).decode("utf-8", "replace").splitlines():
                parts = line.split()
                if len(parts) >= 5 and parts[0].isdigit() and int(parts[0]) in mapping:
                    lines.append(" ".join([str(mapping[int(parts[0])])] + parts[1:]))
        out_lbl.write_text("\n".join(lines), encoding="utf-8")
        if lines:
            n_lbl += 1
    return n_img, n_lbl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("datasets", nargs="+", help="workspace/project:version")
    ap.add_argument("--out", default="cv/dataset")
    ap.add_argument("--key", default=os.environ.get("ROBOFLOW_API_KEY", ""))
    ap.add_argument("--cache", default="cv/data/roboflow")
    args = ap.parse_args()
    if not args.key:
        raise SystemExit("set ROBOFLOW_API_KEY (gratis di roboflow.com → Settings → API Keys)")

    root = Path(args.out)
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    total = [0, 0]
    for spec in args.datasets:
        slug, _, version = spec.partition(":")
        version = version or "1"
        print(f"— {slug} v{version}")
        zpath = cache / f"{re.sub(r'[^a-z0-9]+', '-', spec.lower())}.zip"
        if not zpath.exists():
            fetch_zip(slug, version, args.key, zpath)
        with zipfile.ZipFile(zpath) as zf:
            names = names_from_zip(zf)
            print(f"  classes: {names or 'unknown (no data.yaml)'}")
            n_img, n_lbl = merge(zf, slug, names, root)
        total[0] += n_img
        total[1] += n_lbl
        print(f"  +{n_img} images, {n_lbl} with kept labels")

    yaml = root / "data.yaml"
    yaml.parent.mkdir(parents=True, exist_ok=True)
    yaml.write_text(
        f"path: {root.resolve().as_posix()}\ntrain: images/train\nval: images/val\ntest: images/test\n"
        "names:\n  0: person\n  1: table\n  2: chair\n", encoding="utf-8")
    print(f"\n{total[0]} images, {total[1]} labelled → {yaml}")
    if total[0] and total[1] / max(1, total[0]) < 0.5:
        print("! more than half the images have no person/table/chair box — check the class mapping")


if __name__ == "__main__":
    main()
