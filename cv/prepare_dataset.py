"""Build the 3-class (person, chair, table) YOLO dataset from COCO annotations.

train = subset of train2017 (see fetch_coco_train.py), val = all val2017 images
that contain a chair or a table. The official split is kept, so mAP on val is
not contaminated by training frames.

    python cv/prepare_dataset.py --images cv/data/train2017 --ann cv/data/annotations/instances_train2017.json --split train
    python cv/prepare_dataset.py --images cv/data/val2017   --ann cv/data/annotations/instances_val2017.json   --split val
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

WANTED = {1: 0, 56: 1, 60: 2}  # person, chair, dining table -> 0/1/2
NAMES = ["person", "chair", "table"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images", required=True)
    ap.add_argument("--ann", required=True)
    ap.add_argument("--split", required=True, choices=["train", "val"])
    ap.add_argument("--out", default="cv/dataset")
    ap.add_argument("--limit", type=int, default=100000)
    args = ap.parse_args()

    img_dir = Path(args.images)
    ann_path = Path(args.ann)
    if not ann_path.exists() or not img_dir.exists():
        sys.exit(f"missing {ann_path} or {img_dir}")

    coco = json.loads(ann_path.read_text(encoding="utf-8"))
    by_image = {}
    for a in coco["annotations"]:
        cls = WANTED.get(a["category_id"])
        if cls is None or a.get("iscrowd") or a.get("ignore"):
            continue
        by_image.setdefault(a["image_id"], []).append((cls, a["bbox"]))

    images = {im["id"]: im for im in coco["images"]}
    keep = [i for i, anns in by_image.items() if any(c in (1, 2) for c, _ in anns)]
    if args.split == "train":
        # prefer images with people: an empty chair says nothing about occupancy
        keep.sort(key=lambda i: -sum(1 for c, _ in by_image[i] if c == 0))
    keep = keep[: args.limit]

    out = Path(args.out)
    (out / "images" / args.split).mkdir(parents=True, exist_ok=True)
    (out / "labels" / args.split).mkdir(parents=True, exist_ok=True)

    kept = 0
    stats = {name: 0 for name in NAMES}
    for image_id in keep:
        im = images[image_id]
        src = img_dir / im["file_name"]
        if not src.exists():
            continue
        lines = []
        for cls, (x, y, w, h) in by_image[image_id]:
            cx = (x + w / 2) / im["width"]
            cy = (y + h / 2) / im["height"]
            lines.append(f"{cls} {cx:.6f} {cy:.6f} {w / im['width']:.6f} {h / im['height']:.6f}")
            stats[NAMES[cls]] += 1
        if not lines:
            continue
        shutil.copyfile(src, out / "images" / args.split / im["file_name"])
        (out / "labels" / args.split / (Path(im["file_name"]).stem + ".txt")).write_text("\n".join(lines) + "\n")
        kept += 1

    yaml = out / "oasis-tables.yaml"
    yaml.write_text(
        f"path: {out.resolve().as_posix()}\ntrain: images/train\nval: images/val\n"
        "names:\n  0: person\n  1: chair\n  2: table\n",
        encoding="utf-8",
    )
    print(f"{args.split}: {kept} images · boxes {stats}")


if __name__ == "__main__":
    main()
