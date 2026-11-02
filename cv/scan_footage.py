"""Score candidate clips for the occupancy demo.

For each video: sample frames, count detectable tables (COCO `dining table`) and
people (fine-tuned person model), and report how stable the table count is.
A good demo clip has several tables, plenty of people, and a steady table count.

    python cv/scan_footage.py cv/media/cand2/*.mp4
"""

import argparse
import json
import statistics
import sys
from pathlib import Path

import cv2
from ultralytics import YOLO

TABLE_IDX = {"dining table", "table"}


def scan(path, table_model, person_model, frames=6, conf=0.2, imgsz=960):
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return None
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    if total < 10:
        cap.release()
        return None
    tables_n, people_n, shapes = [], [], []
    for i in range(1, frames + 1):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(total * i / (frames + 1)))
        ok, frame = cap.read()
        if not ok:
            continue
        shapes.append(frame.shape[:2])
        tr = table_model.predict(frame, conf=conf, imgsz=imgsz, verbose=False)[0]
        tn = sum(1 for c in tr.boxes.cls.tolist() if str(table_model.names[int(c)]).lower() in TABLE_IDX)
        pr = person_model.predict(frame, conf=0.3, imgsz=640, verbose=False)[0]
        pn = sum(1 for c in pr.boxes.cls.tolist() if str(person_model.names[int(c)]).lower() == "person")
        tables_n.append(tn)
        people_n.append(pn)
    cap.release()
    if not tables_n:
        return None
    h, w = shapes[0]
    return {
        "file": Path(path).name,
        "seconds": round(total / fps, 1),
        "size": f"{w}x{h}",
        "tables_median": statistics.median(tables_n),
        "tables_min": min(tables_n),
        "tables_max": max(tables_n),
        "people_median": statistics.median(people_n),
        "people_max": max(people_n),
        "score": round(statistics.median(tables_n) * 2 + statistics.median(people_n), 1),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("videos", nargs="+")
    ap.add_argument("--table-model", default="yolo11n.pt")
    ap.add_argument("--person-model", default="cv/runs/tables/weights/best.pt")
    ap.add_argument("--frames", type=int, default=6)
    ap.add_argument("--json", default=None)
    args = ap.parse_args()

    table_model = YOLO(args.table_model)
    person_model = YOLO(args.person_model)
    rows = []
    for v in args.videos:
        row = scan(v, table_model, person_model, args.frames)
        if row:
            rows.append(row)
            print(f"{row['file']:16} {row['tables_median']:>4.0f} tables "
                  f"({row['tables_min']:.0f}-{row['tables_max']:.0f}) · "
                  f"{row['people_median']:>4.0f} people · {row['seconds']:>5}s · {row['size']}")
    rows.sort(key=lambda r: r["score"], reverse=True)
    if args.json:
        Path(args.json).write_text(json.dumps(rows, indent=1), encoding="utf-8")
    if rows:
        best = rows[0]
        print(f"\nbest: {best['file']} · score {best['score']} · {best['tables_median']:.0f} tables, "
              f"{best['people_median']:.0f} people")
    else:
        print("no usable clip")
        sys.exit(1)


if __name__ == "__main__":
    main()
