"""Calibrate a static camera once: merge table detections over N frames into
stable table boxes, assign IDs T01.. and write tables.json.

    python cv/calibrate.py --source cv/media/candidates/7778451.mp4 \
        --zone-model yolo11n.pt --camera-id cam-library-1 --space Library \
        --labels L1,L2,L3,L4 --capacity 4,2,4,6

Why merge instead of one frame: people, bags and columns hide parts of a table
in any single frame. The median box over N spread frames survives that.

Fallback: if the table detector finds fewer than two tables (long canteen
benches), cluster seated people instead (`--cluster-zones N`).
"""

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

DEFAULT_ZONE_MODEL = "yolo11n.pt"


def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    ua = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / ua if ua > 0 else 0.0


def merge_boxes(boxes, min_iou=0.6, min_hits=2):
    """Greedy clustering by IoU, then the median box of each cluster."""
    clusters = []
    for box in boxes:
        placed = False
        for c in clusters:
            if iou(box, c["median"]) >= min_iou:
                c["boxes"].append(box)
                c["median"] = np.median(np.array(c["boxes"]), axis=0).tolist()
                placed = True
                break
        if not placed:
            clusters.append({"boxes": [box], "median": list(box)})
    out = [c["median"] for c in clusters if len(c["boxes"]) >= min_hits]
    out = out or [c["median"] for c in clusters]
    # a big box that swallows a smaller one is the same table seen twice
    out.sort(key=lambda b: (b[2] - b[0]) * (b[3] - b[1]), reverse=True)
    def swallowed(a, b):
        ax1, ay1, ax2, ay2 = a
        bx1, by1, bx2, by2 = b
        iw = max(0.0, min(ax2, bx2) - max(ax1, bx1))
        ih = max(0.0, min(ay2, by2) - max(ay1, by1))
        inter = iw * ih
        small = min((ax2 - ax1) * (ay2 - ay1), (bx2 - bx1) * (by2 - by1)) or 1.0
        return inter / small > 0.92

    kept = []
    for b in out:
        if not any(swallowed(b, k) or iou(b, k) > 0.35 for k in kept):
            kept.append(b)
    return kept


def expand(box, margin, w, h):
    x1, y1, x2, y2 = box
    bw, bh = (x2 - x1) * margin, (y2 - y1) * margin
    return [max(0.0, x1 - bw), max(0.0, y1 - bh), min(float(w - 1), x2 + bw), min(float(h - 1), y2 + bh)]


def cluster_people(points, k, shape, pad=0.5):
    """Tables from where people sit, for benches the table detector cannot see."""
    pts = np.array(points, dtype=np.float32)
    if len(pts) < k:
        return []
    order = np.argsort(pts[:, 0])
    seeds = pts[order[np.linspace(0, len(pts) - 1, k).astype(int)]].copy()
    labels = np.zeros(len(pts), dtype=int)
    for _ in range(25):
        d = ((pts[:, None, :] - seeds[None, :, :]) ** 2).sum(axis=2)
        labels = d.argmin(axis=1)
        for j in range(k):
            if (labels == j).any():
                seeds[j] = pts[labels == j].mean(axis=0)
    h, w = shape[:2]
    boxes = []
    for j in range(k):
        group = pts[labels == j]
        if len(group) == 0:
            continue
        x1, y1 = group.min(axis=0)
        x2, y2 = group.max(axis=0)
        bw, bh = max(1.0, x2 - x1), max(1.0, y2 - y1)
        boxes.append([
            float(max(0.0, x1 - bw * pad)), float(max(0.0, y1 - bh * pad)),
            float(min(w - 1, x2 + bw * pad)), float(min(h - 1, y2 + bh * pad)),
        ])
    return boxes


def order_tables(boxes, rows=2):
    """Stable reading order: split into horizontal bands, sort left to right."""
    if not boxes:
        return []
    heights = sorted((b[3] - b[1]) for b in boxes)
    band = heights[len(heights) // 2] * 0.9 or 1.0
    boxes = sorted(boxes, key=lambda b: ((b[1] + b[3]) / 2, b[0]))
    out, current = [], []
    for b in boxes:
        cy = (b[1] + b[3]) / 2
        if current and cy - (current[-1][1] + current[-1][3]) / 2 > band:
            out.extend(sorted(current, key=lambda x: x[0]))
            current = []
        current.append(b)
    out.extend(sorted(current, key=lambda x: x[0]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--model", default=DEFAULT_ZONE_MODEL,
                    help="person detector used only for the cluster fallback")
    ap.add_argument("--zone-model", default=DEFAULT_ZONE_MODEL, help="table detector")
    ap.add_argument("--frames", type=int, default=60, help="frames to sample across the clip")
    ap.add_argument("--conf", type=float, default=0.15)
    ap.add_argument("--imgsz", type=int, default=960)
    ap.add_argument("--cluster-zones", type=int, default=0,
                    help="fallback: infer N tables from seated people")
    ap.add_argument("--force-cluster", action="store_true",
                    help="skip table detection entirely (long benches defeat it)")
    ap.add_argument("--grid-zones", default="",
                    help="rows,cols — split the people extent into a fixed grid (long benches)")
    ap.add_argument("--camera-id", default="cam-library-1")
    ap.add_argument("--space", default="Library")
    ap.add_argument("--labels", default="", help="map to existing app table labels, e.g. L1,L2,L3,L4")
    ap.add_argument("--capacity", default="4", help="per-table capacity, comma list or single value")
    ap.add_argument("--margin", type=float, default=0.15, help="zone padding around each table box")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    cap = cv2.VideoCapture(args.source)
    if not cap.isOpened():
        raise SystemExit(f"cannot open {args.source}")
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    if total <= 0:
        raise SystemExit("clip has no frame count; pass a file, not a stream")

    table_model = YOLO(args.zone_model)
    person_model = YOLO(args.model) if (args.cluster_zones or args.grid_zones) else None
    table_names = {i for i, n in table_model.names.items() if str(n).lower() in ("dining table", "table")}

    picks = np.linspace(0, max(0, total - 2), args.frames).astype(int)
    boxes, points, shape = [], [], None
    for idx in picks:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ok, frame = cap.read()
        if not ok:
            continue
        shape = shape or frame.shape
        res = table_model.predict(frame, conf=args.conf, imgsz=args.imgsz, verbose=False)[0]
        for box, cls in zip(res.boxes.xyxy.tolist(), res.boxes.cls.tolist()):
            if int(cls) in table_names:
                boxes.append([float(v) for v in box])
        if person_model and len(points) < 400:
            pr = person_model.predict(frame, conf=0.3, imgsz=args.imgsz, verbose=False)[0]
            for box, cls in zip(pr.boxes.xyxy.tolist(), pr.boxes.cls.tolist()):
                if str(person_model.names[int(cls)]).lower() == "person":
                    points.append(((box[0] + box[2]) / 2, box[3]))
    cap.release()

    method = "table-median"
    merged = [] if args.force_cluster else (merge_boxes(boxes) if boxes else [])
    if args.grid_zones and points:
        rows, cols = [int(v) for v in args.grid_zones.split(",")]
        pts = np.array(points, dtype=np.float32)
        x1, y1 = pts.min(axis=0)
        x2, y2 = pts.max(axis=0)
        pad_x, pad_y = (x2 - x1) * 0.05, (y2 - y1) * 0.05
        xs = np.linspace(x1 - pad_x, x2 + pad_x, cols + 1)
        ys = np.linspace(y1 - pad_y, y2 + pad_y, rows + 1)
        h0, w0 = shape[:2]
        clamp = lambda v, hi: float(max(0, min(hi - 1, v)))
        merged = [[clamp(xs[c], w0), clamp(ys[r], h0), clamp(xs[c + 1], w0), clamp(ys[r + 1], h0)]
                  for r in range(rows) for c in range(cols)]
        method = "grid"
    if len(merged) < 2 and args.cluster_zones and points:
        merged = cluster_people(points, args.cluster_zones, shape)
        method = "person-cluster"
    if not merged:
        raise SystemExit("no tables found; check the clip or pass --cluster-zones")

    merged = order_tables(merged)
    labels = [s for s in args.labels.split(",") if s]
    caps = [int(v) for v in str(args.capacity).split(",") if v]
    h, w = shape[:2]
    tables = []
    for i, box in enumerate(merged):
        zone = expand(box, args.margin, w, h)
        tables.append({
            "id": f"T{i + 1:02d}",
            "app_label": labels[i] if i < len(labels) else f"T{i + 1:02d}",
            "capacity": caps[i] if i < len(caps) else caps[0],
            "bbox": [round(v, 1) for v in box],
            "polygon": [[round(zone[0], 1), round(zone[1], 1)], [round(zone[2], 1), round(zone[1], 1)],
                        [round(zone[2], 1), round(zone[3], 1)], [round(zone[0], 1), round(zone[3], 1)]],
        })

    out = Path(args.out or f"cv/tables/{args.camera_id}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    doc = {
        "camera_id": args.camera_id,
        "space": args.space,
        "source": Path(args.source).name,
        "method": method,
        "frames_sampled": int(len(picks)),
        "frame_size": [w, h],
        "calibrated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tables": tables,
    }
    out.write_text(json.dumps(doc, indent=1), encoding="utf-8")
    print(f"{len(tables)} tables ({method}) -> {out}")
    for t in tables:
        print(f"  {t['id']} -> {t['app_label']} · cap {t['capacity']} · {[int(v) for v in t['bbox']]}")


if __name__ == "__main__":
    main()
