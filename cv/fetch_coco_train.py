"""Download the COCO train2017 images that actually contain chairs or tables.

COCO val2017 only has 132 such images — too few to fine-tune on. train2017 is
18 GB whole, but the annotation file lets us fetch just the ~N images we need
(~150 KB each). Training on train2017 and evaluating on val2017 keeps the
official split, so the reported mAP is honest.

    python cv/fetch_coco_train.py --limit 3000 --workers 16
"""

import argparse
import concurrent.futures as cf
import json
import sys
import urllib.request
from pathlib import Path

BASE = "http://images.cocodataset.org/train2017/"
WANTED = {1, 56, 60}  # person, chair, dining table


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="cv/data")
    ap.add_argument("--limit", type=int, default=3000)
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args()

    data = Path(args.data)
    ann_path = data / "annotations" / "instances_train2017.json"
    if not ann_path.exists():
        sys.exit(f"missing {ann_path} — unzip annotations_trainval2017.zip into {data}")

    coco = json.loads(ann_path.read_text(encoding="utf-8"))
    has_furniture = {a["image_id"] for a in coco["annotations"] if a["category_id"] in (56, 60) and not a.get("iscrowd")}
    images = [im for im in coco["images"] if im["id"] in has_furniture]
    print(f"train2017 images with chair/table: {len(images)}")

    # Prefer scenes with several people: an empty chair proves nothing about
    # occupancy. Score = person instances on that image.
    people = {}
    for a in coco["annotations"]:
        if a["category_id"] == 1 and a["image_id"] in has_furniture:
            people[a["image_id"]] = people.get(a["image_id"], 0) + 1
    images.sort(key=lambda im: (-people.get(im["id"], 0), im["id"]))
    images = images[: args.limit]

    out = data / "train2017"
    out.mkdir(parents=True, exist_ok=True)
    todo = [im for im in images if not (out / im["file_name"]).exists()]
    print(f"downloading {len(todo)} images with {args.workers} workers")

    def fetch(im):
        dst = out / im["file_name"]
        try:
            urllib.request.urlretrieve(BASE + im["file_name"], dst)
            return True
        except Exception as exc:  # noqa: BLE001 - one bad image must not stop the set
            print("skip", im["file_name"], exc)
            return False

    ok = 0
    with cf.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for done, good in enumerate(pool.map(fetch, todo), 1):
            ok += good
            if done % 250 == 0:
                print(f"  {done}/{len(todo)} ({ok} ok)")
    print(f"downloaded {ok} · folder now {len(list(out.glob('*.jpg')))} images")


if __name__ == "__main__":
    main()
