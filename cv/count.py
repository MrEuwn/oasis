"""Count people per calibrated table, with tracking and smoothing.

    # demo file -> timeline JSON for the web tile
    python cv/count.py --source cv/media/candidates/7778451.mp4 \
        --tables cv/tables/cam-library-1.json --out public/cam/library.json \
        --annotate cv/media/library-counted.mp4 --max-seconds 17

    # live camera -> POST integers to /api/sensor
    python cv/count.py --source rtsp://... --tables cv/tables/cam-library-1.json --api http://localhost:3001

Rules that keep the number from flickering:
* one track belongs to at most one table,
* the point used is the person's feet, not the box centre,
* the reported count is the median of the last N samples (default 10 ≈ 2 s at 5 fps).
"""

import argparse
import json
import statistics
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

from calibrate import expand


def load_tables(path):
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    for t in doc["tables"]:
        t["poly"] = np.array(t["polygon"], dtype=np.int32)
        cx = (t["bbox"][0] + t["bbox"][2]) / 2
        cy = (t["bbox"][1] + t["bbox"][3]) / 2
        t["centroid"] = (cx, cy)
        t["reach"] = max(40.0, (t["bbox"][3] - t["bbox"][1]) * 0.6)
    # Bound each table's reach by half the gap to its nearest neighbour: two
    # cluster zones can overlap, and unbounded reach would hand every person to
    # whichever table happens to be closest across the whole room.
    for t in doc["tables"]:
        gaps = [((t["centroid"][0] - o["centroid"][0]) ** 2 + (t["centroid"][1] - o["centroid"][1]) ** 2) ** 0.5
                for o in doc["tables"] if o is not t]
        if gaps:
            t["reach"] = max(40.0, min(t["reach"], 0.55 * min(gaps)))
    return doc


def assign(feet, tables):
    """Distance to each table rectangle, not to its centre.

    Centre distance fails for wide grid cells and for small tables alike;
    rectangle distance handles both: inside the box is zero, sitting beside it
    is small, walking down the aisle is larger than the margin.
    """
    x, y = feet
    best = None
    for t in tables:
        x1, y1, x2, y2 = t["bbox"]
        dx = max(x1 - x, 0.0, x - x2)
        dy = max(y1 - y, 0.0, y - y2)
        dist = (dx * dx + dy * dy) ** 0.5
        span = min(x2 - x1, y2 - y1)
        margin = max(30.0, span * 0.35)
        if dist <= margin:
            score = dist / margin
            if best is None or score < best[0]:
                best = (score, t["id"])
    return best[1] if best else None


def status_for(count, capacity):
    if count <= 0:
        return "empty"
    return "full" if count >= capacity else "partial"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--tables", required=True)
    ap.add_argument("--model", default="cv/runs/tables/weights/best.pt")
    ap.add_argument("--interval", type=float, default=0.2, help="seconds between analysed frames")
    ap.add_argument("--conf", type=float, default=0.3)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--smooth", type=int, default=10, help="median window in samples")
    ap.add_argument("--annotate", default=None)
    ap.add_argument("--dump", default=None, help="append one JSON line per sample")
    ap.add_argument("--out", default=None, help="write a web timeline JSON (demo mode)")
    ap.add_argument("--api", default=None, help="POST readings to this base url")
    ap.add_argument("--key", default="oasis-demo-camera")
    ap.add_argument("--max-seconds", type=float, default=0)
    ap.add_argument("--tracker", default="bytetrack.yaml")
    args = ap.parse_args()

    doc = load_tables(args.tables)
    tables = doc["tables"]
    by_id = {t["id"]: t for t in tables}

    model = YOLO(args.model)
    src = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        raise SystemExit(f"cannot open {args.source}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    step = max(1, int(round(fps * args.interval)))

    windows = {t["id"]: deque(maxlen=args.smooth) for t in tables}
    track_table = {}
    writer = None
    samples = []
    frame_no = 0
    started = time.time()

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_no += 1
        if (frame_no - 1) % step:
            continue
        if args.max_seconds and frame_no / fps > args.max_seconds:
            break

        res = model.track(frame, conf=args.conf, imgsz=args.imgsz, persist=True,
                          tracker=args.tracker, verbose=False)[0]
        boxes = res.boxes
        ids = boxes.id.tolist() if boxes.id is not None else [None] * len(boxes)
        counts = defaultdict(int)
        unassigned = 0
        conf_of = defaultdict(float)
        drawn = []

        for box, tid, cls, score in zip(boxes.xyxy.tolist(), ids, boxes.cls.tolist(), boxes.conf.tolist()):
            if str(model.names[int(cls)]).lower() != "person":
                continue
            feet = ((box[0] + box[2]) / 2, box[3])
            key = int(tid) if tid is not None else None
            table_id = assign(feet, tables)
            if key is not None:
                if table_id:
                    track_table[key] = table_id
                else:
                    track_table.pop(key, None)
            if table_id:
                counts[table_id] += 1
                conf_of[table_id] = max(conf_of[table_id], float(score))
            else:
                unassigned += 1
            drawn.append((box, key, table_id, float(score)))

        # smoothing + payload
        payload_tables = []
        for t in tables:
            windows[t["id"]].append(counts.get(t["id"], 0))
            count = int(round(statistics.median(windows[t["id"]])))
            payload_tables.append({
                "id": t["id"],
                "app_label": t["app_label"],
                "bbox": t["bbox"],
                "person_count": count,
                "status": status_for(count, t["capacity"]),
                "capacity": t["capacity"],
                # the zone can hold more people than the app's seat count (trays,
                # standing, a grid cell spanning two benches): flag it, do not hide it
                "over_capacity": count > t["capacity"],
                "confidence": round(conf_of.get(t["id"], 0.0), 3),
            })

        total = sum(p["person_count"] for p in payload_tables)
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "camera_id": doc["camera_id"],
            "space": doc.get("space"),
            "tables": payload_tables,
            "total_people": total,
            "unassigned": unassigned,
            "fps": round(fps / step, 2),
            "zones_method": doc.get("method"),
            "source": "live" if not args.out else "replay",
        }
        if args.dump:
            with open(args.dump, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(payload) + "\n")

        if args.out:
            samples.append({
                "t": round((frame_no - 1) / fps, 2),
                "people": total,
                "unassigned": unassigned,
                "confidence": round(max((p["confidence"] for p in payload_tables), default=0.0), 3),
                "zones": {
                    p["app_label"]: {
                        "id": p["id"],
                        "bbox": p["bbox"],
                        "people": p["person_count"],
                        "capacity": p["capacity"],
                        "status": p["status"],
                        "over_capacity": p.get("over_capacity", False),
                        "occupied": p["person_count"] > 0,
                        "confidence": p["confidence"],
                    } for p in payload_tables
                },
            })

        if args.api:
            try:
                import requests
                requests.post(f"{args.api.rstrip('/')}/api/sensor", timeout=5,
                              headers={"x-sensor-key": args.key},
                              json={"camera_id": doc["camera_id"], "space": doc.get("space"),
                                    "tables": [{"label": p["app_label"], "occupied": p["person_count"] > 0,
                                                "people": p["person_count"], "chairs": 0,
                                                "confidence": p["confidence"]} for p in payload_tables]})
            except Exception as exc:  # a dropped frame must not kill the loop
                print("post failed:", exc)

        if args.annotate:
            for t in tables:
                p = next(x for x in payload_tables if x["id"] == t["id"])
                colour = (90, 200, 120) if p["status"] == "empty" else \
                         (60, 160, 240) if p["status"] == "partial" else (80, 80, 230)
                cv2.polylines(frame, [t["poly"]], True, colour, 2)
                label = f"{t['id']} {t['app_label']} {p['person_count']}p"
                lx, ly = int(t["bbox"][0]) + 4, int(t["bbox"][1]) + 6
                (tw, th), _base = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
                cv2.rectangle(frame, (lx - 3, ly - 2), (lx + tw + 3, ly + th + 4), (18, 22, 18), -1)
                cv2.putText(frame, label, (lx, ly + th),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (240, 238, 228), 2, cv2.LINE_AA)
            for box, key, table_id, _score in drawn:
                x1, y1, x2, y2 = [int(v) for v in box]
                cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 190, 90), 1)
                if key is not None:
                    cv2.putText(frame, f"#{key}", (x1, max(12, y1 - 4)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 190, 90), 1, cv2.LINE_AA)
            if writer is None:
                h, w = frame.shape[:2]
                writer = cv2.VideoWriter(args.annotate, cv2.VideoWriter_fourcc(*"mp4v"), fps / step, (w, h))
            writer.write(frame)
        print(json.dumps({"t": round(frame_no / fps, 1), "total": total,
                          "tables": {p["app_label"]: p["person_count"] for p in payload_tables},
                          "unassigned": unassigned}))

    cap.release()
    if writer:
        writer.release()
        print(f"annotated -> {args.annotate}")

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({
            "camera_id": doc["camera_id"],
            "space": doc.get("space"),
            "source": "pexels · free licence",
            "note": f"Recorded replay, overlay baked in. Table zones locked by {doc['method']} in {Path(args.tables).name}.",
            "fps": round(fps / step, 2),
            "zones_method": doc.get("method"),
            "duration": samples[-1]["t"] if samples else 0,
            "samples": samples,
        }), encoding="utf-8")
        print(f"timeline -> {out} ({len(samples)} samples)")

    print(f"done · {len(samples) or frame_no} samples in {time.time() - started:.1f}s")


if __name__ == "__main__":
    main()
