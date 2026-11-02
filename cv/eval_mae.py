"""Check the demo counting against CDED-7's own annotations (MAE per table).

CDED-7 ships `derived_status_boxes.csv`: one row per annotated person per frame.
That is real ground truth for "how many people are at this table", so the demo
number can be scored instead of trusted.

    python cv/eval_mae.py --video class_3 --timeline public/cam/library.json \
        --tables cv/tables/cam-library-1.json \
        --csv cv/media/cded7/derived_release/derived_status_boxes.csv

Frames are 1-indexed in the CSV; the timeline is keyed by seconds, so frame =
round(t * fps) + 1 at 25 fps (CDED-7 is 25 fps).
"""

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import cv2


def point_in(poly, x, y):
    return cv2.pointPolygonTest(poly, (float(x), float(y)), False) >= 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", default="class_3")
    ap.add_argument("--csv", default="cv/media/cded7/derived_release/derived_status_boxes.csv")
    ap.add_argument("--tables", required=True)
    ap.add_argument("--timeline", required=True)
    ap.add_argument("--fps", type=float, default=25.0)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    doc = json.loads(Path(args.tables).read_text(encoding="utf-8"))
    zones = [(t["app_label"], np.array(t["polygon"], dtype=np.int32)) for t in doc["tables"]]
    samples = json.loads(Path(args.timeline).read_text(encoding="utf-8"))["samples"]
    by_t = {round(s["t"], 2): s for s in samples}

    truth = defaultdict(lambda: defaultdict(int))
    with open(args.csv, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["video"] != args.video:
                continue
            fid = int(row["frame_id"])
            # feet point = bottom centre, same rule the counter uses
            x = (float(row["x1"]) + float(row["x2"])) / 2
            y = float(row["y2"])
            for label, poly in zones:
                if point_in(poly, x, y):
                    truth[fid][label] += 1
                    break

    diffs, table_diffs = [], defaultdict(list)
    for t, sample in sorted(by_t.items()):
        fid = int(round(t * args.fps)) + 1
        if fid not in truth:
            continue
        for label, _poly in zones:
            got = sample["zones"].get(label, {}).get("people", 0)
            want = truth[fid].get(label, 0)
            diffs.append(abs(got - want))
            table_diffs[label].append(abs(got - want))

    if not diffs:
        raise SystemExit("no overlapping frames — check --video / --fps")

    mae = sum(diffs) / len(diffs)
    print(f"{args.video}: {len(diffs)} table-samples, MAE {mae:.2f} people/table "
          f"(max {max(diffs)})")
    for label in sorted(table_diffs):
        vals = table_diffs[label]
        print(f"  {label}: MAE {sum(vals) / len(vals):.2f} over {len(vals)} samples")
    my_mae = sum(abs(by_t[t]["people"] - sum(truth[int(round(t * args.fps)) + 1].values()))
                 for t in by_t if int(round(t * args.fps)) + 1 in truth)
    n = sum(1 for t in by_t if int(round(t * args.fps)) + 1 in truth)
    if n:
        print(f"  total people: MAE {my_mae / n:.2f} over {n} frames")

    if args.out:
        Path(args.out).write_text(json.dumps({
            "video": args.video,
            "samples": len(diffs),
            "mae_per_table": round(mae, 3),
            "mae_total": round(my_mae / n, 3) if n else None,
            "per_table": {k: round(sum(v) / len(v), 3) for k, v in table_diffs.items()},
        }, indent=1), encoding="utf-8")
        print(f"-> {args.out}")


if __name__ == "__main__":
    main()
