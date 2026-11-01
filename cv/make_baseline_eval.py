"""Evaluate the stock COCO model on our 3-class val split, for an honest baseline.

Ultralytics matches classes by index, so a 3-class dataset scored against an
80-class checkpoint reports nonsense (chair becomes bicycle). This builds a
val-only copy whose labels use the COCO ids (0 person, 56 chair, 60 dining
table) and a YAML with all 80 names, then runs `yolo val`.

    python cv/make_baseline_eval.py
    yolo detect val model=yolo11n.pt data=cv/dataset-coco/oasis-coco.yaml imgsz=512
"""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC_IMAGES = ROOT / "dataset" / "images" / "val"
SRC_LABELS = ROOT / "dataset" / "labels" / "val"
OUT = ROOT / "dataset-coco"
REMAP = {1: 56, 2: 60}  # our chair/table ids -> COCO ids

COCO_NAMES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
    "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard",
    "tennis racket", "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
    "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard",
    "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock", "vase",
    "scissors", "teddy bear", "hair drier", "toothbrush",
]


def main():
    if not SRC_IMAGES.exists():
        raise SystemExit("run prepare_dataset.py --split val first")
    images = OUT / "images" / "val"
    labels = OUT / "labels" / "val"
    images.mkdir(parents=True, exist_ok=True)
    labels.mkdir(parents=True, exist_ok=True)

    for txt in SRC_LABELS.glob("*.txt"):
        lines = []
        for line in txt.read_text(encoding="utf-8").strip().splitlines():
            cls, *rest = line.split()
            lines.append(" ".join([str(REMAP.get(int(cls), int(cls))), *rest]))
        (labels / txt.name).write_text("\n".join(lines) + "\n", encoding="utf-8")
    for img in SRC_IMAGES.iterdir():
        dst = images / img.name
        if not dst.exists():
            shutil.copyfile(img, dst)

    yaml = OUT / "oasis-coco.yaml"
    names = "\n".join(f"  {i}: {name}" for i, name in enumerate(COCO_NAMES))
    yaml.write_text(
        f"path: {OUT.as_posix()}\ntrain: images/val\nval: images/val\nnames:\n{names}\n",
        encoding="utf-8",
    )
    print(f"wrote {yaml} · {len(list(images.iterdir()))} images")


if __name__ == "__main__":
    main()
