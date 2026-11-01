"""Edge occupancy detector: camera frames in, table counts out.

Runs on the machine next to the camera (or on a replay file for the demo).
Pixels never leave the process: the only thing posted is
{camera, space, table label, people, chairs} — no frames, no faces, no ids.

    # one camera, live
    python cv/detect.py --source rtsp://user:pass@10.0.0.14/stream1 --cameras cv/cameras.json

    # replay a video and write an annotated copy for the pitch
    python cv/detect.py --source cv/media/study.mp4 --auto-zones --space Library \
        --annotate cv/media/study-annotated.mp4 --api http://localhost:3001

Zones are polygons in image pixels. `--auto-zones` derives them once from the
table detections on the first sampled frame, then they stay fixed, which keeps
the reading stable frame to frame.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import requests
from ultralytics import YOLO

DEFAULT_MODEL = "yolov8n.pt"


def class_index(model, *names):
    wanted = {n.lower() for n in names}
    return [i for i, n in model.names.items() if str(n).lower() in wanted]


def zone_from_box(box, pad=0.35):
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    # a table zone includes the chairs around it, so pad downward more: people
    # sit below the tabletop in a high-angle view
    return [
        [x1 - pad * w, y1 - pad * h],
        [x2 + pad * w, y1 - pad * h],
        [x2 + pad * w, y2 + pad * h * 1.2],
        [x1 - pad * w, y2 + pad * h * 1.2],
    ]


def inside(polygon, point):
    return cv2.pointPolygonTest(np.array(polygon, dtype=np.int32), point, False) >= 0


def auto_zones(model, frame, conf, labels):
    idx = class_index(model, "table", "dining table")
    res = model.predict(frame, conf=conf, classes=idx, verbose=False)[0]
    # biggest table first: in a fixed camera view the nearest table is the
    # largest, and the labels (L1, L2, ...) should not shuffle when a chair or
    # a person changes the vertical order
    boxes = sorted(res.boxes.xyxy.tolist(), key=lambda b: -((b[2] - b[0]) * (b[3] - b[1])))[: len(labels)]
    zones = []
    for i, box in enumerate(boxes):
        zones.append({"label": labels[i] if i < len(labels) else f"T{i + 1}", "polygon": zone_from_box(box)})
    return zones


def count_zone(people, chairs, polygon):
    n_people = sum(1 for (cx, cy, _c) in people if inside(polygon, (cx, cy)))
    n_chairs = sum(1 for (cx, cy) in chairs if inside(polygon, (cx, cy)))
    conf = max([c for (cx, cy, c) in people if inside(polygon, (cx, cy))] or [0.0])
    return n_people, n_chairs, conf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="video file, rtsp:// url or webcam index")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--zone-model", default=None, help="model used once to derive table zones (defaults to --model)")
    ap.add_argument("--cameras", default="cv/cameras.json", help="zones file, written by --auto-zones")
    ap.add_argument("--space", default=None, help="campus room name, e.g. Library")
    ap.add_argument("--camera-id", default="cam-library-1")
    ap.add_argument("--auto-zones", action="store_true", help="derive zones from the first frame and save them")
    ap.add_argument("--save-zones", default=None)
    ap.add_argument("--labels", default="L1,L2,L3,L4,L5,L6")
    ap.add_argument("--interval", type=float, default=2.0, help="seconds between analysed frames")
    ap.add_argument("--conf", type=float, default=0.35)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--api", default="http://localhost:3001")
    ap.add_argument("--key", default="oasis-demo-camera")
    ap.add_argument("--annotate", default=None, help="write an annotated mp4 here")
    ap.add_argument("--dump", default=None, help="write one JSON line per analysed frame here")
    ap.add_argument("--max-seconds", type=float, default=0, help="stop after N seconds of source time")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    model = YOLO(args.model)
    person_idx = class_index(model, "person")
    chair_idx = class_index(model, "chair")
    if not person_idx:
        sys.exit(f"{args.model} has no person class")

    src = int(args.source) if args.source.isdigit() else args.source
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        sys.exit(f"cannot open {args.source}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    step = max(1, int(round(fps * args.interval)))

    zones = None
    if not args.auto_zones:
        cfg = json.loads(Path(args.cameras).read_text(encoding="utf-8"))
        args.camera_id = cfg.get("camera_id", args.camera_id)
        args.space = args.space or cfg.get("space")
        zones = cfg["zones"]

    writer = None
    frame_no = 0
    analysed = 0
    started = time.time()
    last_payload = None

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frame_no += 1
        if (frame_no - 1) % step:
            continue
        if args.max_seconds and frame_no / fps > args.max_seconds:
            break

        res = model.predict(frame, conf=args.conf, imgsz=args.imgsz, verbose=False)[0]
        boxes = res.boxes
        names = [model.names[int(c)] for c in boxes.cls.tolist()]
        people, chairs = [], []
        for box, name, score in zip(boxes.xyxy.tolist(), names, boxes.conf.tolist()):
            x1, y1, x2, y2 = box
            if name == "person":
                # use the feet (bottom of the box) to decide which table
                people.append(((x1 + x2) / 2, y2, float(score)))
            elif name == "chair":
                chairs.append(((x1 + x2) / 2, (y1 + y2) / 2))

        if zones is None:
            zone_model = YOLO(args.zone_model) if args.zone_model else model
            zones = auto_zones(zone_model, frame, args.conf, args.labels.split(","))
            if not zones:
                sys.exit("no table detected on the first frame — point the camera at tables or write zones by hand")
            out = args.save_zones or args.cameras
            Path(out).parent.mkdir(parents=True, exist_ok=True)
            Path(out).write_text(
                json.dumps({"camera_id": args.camera_id, "space": args.space, "zones": zones}, indent=1),
                encoding="utf-8",
            )
            print(f"auto zones -> {out} ({len(zones)} tables)")

        readings = []
        for zone in zones:
            n_people, n_chairs, conf = count_zone(people, chairs, zone["polygon"])
            readings.append(
                {
                    "label": zone["label"],
                    "occupied": n_people > 0,
                    "people": n_people,
                    "chairs": n_chairs,
                    "confidence": round(conf, 3),
                }
            )

        payload = {"camera_id": args.camera_id, "space": args.space, "tables": readings}
        last_payload = payload
        analysed += 1

        if not args.dry_run and args.api:
            try:
                requests.post(
                    f"{args.api.rstrip('/')}/api/sensor",
                    json=payload,
                    headers={"x-sensor-key": args.key},
                    timeout=5,
                )
            except Exception as exc:  # noqa: BLE001 - a dropped frame must not kill the loop
                print("post failed:", exc)

        if args.annotate:
            for zone in zones:
                pts = np.array(zone["polygon"], dtype=np.int32)
                occupied = next(r for r in readings if r["label"] == zone["label"])["occupied"]
                colour = (80, 80, 255) if occupied else (140, 220, 120)
                cv2.polylines(frame, [pts], True, colour, 2)
                cv2.putText(
                    frame,
                    f"{zone['label']} {'BUSY' if occupied else 'FREE'}",
                    (int(pts[:, 0].min()) + 6, int(pts[:, 1].min()) + 22),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    colour,
                    2,
                    cv2.LINE_AA,
                )
            for (cx, cy, _c) in people:
                cv2.circle(frame, (int(cx), int(cy)), 4, (255, 200, 80), -1)
            if writer is None:
                h, w = frame.shape[:2]
                writer = cv2.VideoWriter(args.annotate, cv2.VideoWriter_fourcc(*"mp4v"), fps / step, (w, h))
            writer.write(frame)

        print(
            json.dumps(
                {
                    "t": round(frame_no / fps, 1),
                    "tables": {r["label"]: f"{r['people']}p" for r in readings},
                }
            )
        )
        if args.dump:
            with open(args.dump, "a", encoding="utf-8") as fh:
                fh.write(json.dumps({"t": round(frame_no / fps, 2), "readings": readings}) + "\n")

    cap.release()
    if writer:
        writer.release()
        print(f"annotated -> {args.annotate}")
    print(f"done · {analysed} frames analysed in {time.time() - started:.1f}s")
    if args.dry_run and last_payload:
        print(json.dumps(last_payload))


if __name__ == "__main__":
    main()
