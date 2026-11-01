# Camera occupancy (edge CV)

Adds a second, independent source of truth to the radar: a camera on the wall
counts people at each table and posts **counts only** to the app. Bookings still
own the table; the camera fills the gaps (walk-ins, no-shows, people sitting
without booking).

## Privacy stance (this changes a PRD non-goal — deliberately)

PRD v3 lists "no cameras, no sensors" as a non-goal. This module is an opt-in
extension, and it keeps the original intent intact:

- inference runs **on the device next to the camera**, nothing is uploaded but
  integers: `{camera_id, space, label, occupied, people, chairs, confidence}`;
- no frames, crops, faces, identities, embeddings or timestamps-of-persons are
  sent or stored;
- the server keeps only the latest reading per table and forgets it after
  10 minutes; a dead camera degrades silently to booking-only truth;
- the detector refuses to write frames unless the operator passes
  `--annotate` (used for the pitch video, never in production);
- a room can run with or without a camera: `space.camera` is `false` until a
  reading lands.

If the campus privacy policy forbids cameras outright, nothing else in OASIS
depends on this module.

## How it works

```
camera / RTSP ──► detect.py ──► YOLO11n (3 classes: person, chair, table)
                     │
                     ├─ table zones (polygons in image space, auto-derived once)
                     ├─ person foot point inside zone?  → people count
                     ├─ chair centres inside zone       → chair count
                     └─ POST /api/sensor  (x-sensor-key)  → db.sensor_readings
                                                             │
                                            /api/state ──────┘ → table.camera
                                                                 → status: in_use
```

Fusion rule in `lib/domain.js`:

| Booking | Camera | Status shown |
| --- | --- | --- |
| none | nobody | `empty` |
| none | people | `in_use` (booking refused: "the camera sees 2 people") |
| booked / open | any | booking status wins (no-show stays visible) |
| any | reading older than 90 s | ignored until the next reading |

## Train

```bash
python -m venv cv/.venv                      # or: uv venv cv/.venv --python 3.12
cv/.venv/Scripts/pip install ultralytics opencv-python-headless requests

# data: COCO train2017 subset (chairs/tables, people first) + full val2017 furniture split
python cv/fetch_coco_train.py --limit 3000
unzip cv/data/annotations_trainval2017.zip -d cv/data
unzip cv/data/val2017.zip -d cv/data
python cv/prepare_dataset.py --images cv/data/train2017 --ann cv/data/annotations/instances_train2017.json --split train
python cv/prepare_dataset.py --images cv/data/val2017   --ann cv/data/annotations/instances_val2017.json   --split val

# fine-tune from COCO weights (CPU-friendly recipe: frozen backbone, 448 px, 8 epochs)
yolo detect train model=yolo11n.pt data=cv/dataset/oasis-tables.yaml \
  imgsz=448 epochs=8 batch=24 device=cpu workers=4 freeze=12 lr0=0.002 \
  fraction=0.55 cache=ram project=cv/runs name=tables
```

Dataset: 3 000 train images (2 778 person · 5 858 chair · 6 284 table boxes),
132 val images from the official val2017 split (106 · 312 · 328). Official split
kept, so val frames never leak into training.

## Metrics

See [`RESULTS.md`](RESULTS.md). Headline: on the official val2017 split the
fine-tune lifts chair mAP50 from **0.00 → 0.38** and table **0.00 → 0.56**, while
person drops 0.86 → 0.78; on the demo clip, table-level occupancy agrees with
hand labels **32/32** with a people-count MAE of 0.06. CPU-only: 1.2 s/frame.

Re-run the numbers with:

```bash
python cv/score_occupancy.py --labels cv/labels/study.json --readings cv/runs/study-ft.jsonl
```

## Run

```bash
# live camera
cv/.venv/Scripts/python cv/detect.py --source rtsp://user:pass@10.0.0.14/stream1 \
  --model cv/runs/tables/weights/best.pt --cameras cv/cameras.json --space Library

# replay file, annotate for the pitch, post to the local app
cv/.venv/Scripts/python cv/detect.py --source cv/media/study.mp4 \
  --model cv/runs/tables/weights/best.pt --auto-zones --space Library \
  --labels L1,L2,L3,L4 --interval 2 --annotate cv/media/study-cam.mp4 \
  --api http://localhost:3001
```

`--auto-zones` derives one polygon per detected table on the first sampled frame
and writes `cv/cameras.json`; run once per camera, then reuse the file (a fixed
polygon beats a jittery per-frame box). Zones are sorted by table area, biggest
first, so `L1` is the nearest table and labels never shuffle when a person walks
in. Zones are in image pixels, so they survive restarts but not camera moves.

Set `SENSOR_SECRET` in production and pass the same value as `--key`. Without
it the demo key `oasis-demo-camera` is accepted from `localhost` only.

## Limits (honest)

- One camera sees one room; overlapping cameras need one zone file each and the
  last writing camera wins per table.
- Occupied means "a person's feet are inside the table polygon". Someone
  standing next to a table counts; a bag on a chair does not.
- Chairs are counted but not assigned to persons; seat-level occupancy is not
  claimed.
- Heavy occlusion (a crowd) undercounts; the reading is advisory, never a
  punishment. No points are ever deducted from a camera reading.
- Training and inference here are CPU-only (no GPU on this machine): ~7 s per
  frame at 640 px, which is why the demo samples one frame every 2 s.
