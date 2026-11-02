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
fine-tune lifts chair mAP50 from **0.00 → 0.40** and table **0.00 → 0.57**, while
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

### Footage sources

**CDED-7** (Classroom Distraction Evaluation Dataset, Zenodo `10.5281/zenodo.21207208`,
`fangsheng223/classroom-distraction-tracker`) supplies seven 1920×1080 classroom videos shot from a fixed
high camera — the closest free match to a CCTV room. Licence: research / non-commercial only, so it powers
the demo (`cv/media/cded7/videos/class_3.mp4`) and local testing, and is never redistributed.

Pexels downloads work head-less via `https://www.pexels.com/download/video/<id>/` (302 → CDN mp4, no key).
Mixkit pages only expose a **watermarked** Envato preview when scraped, so Mixkit clips are not used for
judging material unless downloaded by hand from the site.

### Replay assets used by the web demo

`cv/media/study.mp4` (Pexels 7778452, free licence) → `cv/media/library-preview.mp4` + `library-readings.jsonl`
→ `public/cam/library.{mp4,jpg,json}` via `node scripts/build-cam.mjs`. The dashboard labels this a replay.

### Calibrate once, then count (v2 pipeline)

```bash
# 1. lock the tables for a camera (median over 40 frames, IDs T01.., capacity, zones)
python cv/calibrate.py --source cv/media/candidates/7778451.mp4 --zone-model yolo11n.pt   --camera-id cam-library-1 --space Library --labels L1,L2,L3,L4,L5,L6   --capacity 4,2,4,6,2,8 --frames 40 --imgsz 960
# long benches: table detection fails, so split the seated band into a grid
python cv/calibrate.py --source cv/media/cafeteria.mp4 --grid-zones 1,4   --camera-id cam-canteen-1 --space "Student Centre" --labels S1,S2,S3,S4 --capacity 4,6,2,4

# k-means over seated people exists too (--force-cluster --cluster-zones 4) but its
# zones overlap heavily; grid zones assign cleanly, so prefer the grid for benches.

# 2. count people per table with tracking + smoothing, write the web timeline
python cv/count.py --source cv/media/candidates/7778451.mp4   --tables cv/tables/cam-library-1.json --out public/cam/library.json   --annotate cv/media/library-counted.mp4 --max-seconds 17

# 3. encode the loop used by the admin tile
node scripts/build-cam.mjs
```

`cv/tables/<camera>.json` is the source of truth for IDs, polygons and capacity: edit it (or
recalibrate) and the dashboard, the API payload and the replay all follow. Counts are the median of the
last 10 samples and one track belongs to at most one table.

Assignment rule: distance from the person's feet to each **table rectangle** (inside = 0, beside = small),
accepted if within `0.35 × min(width, height)` of that table; the nearest accepted one wins, everything
else is reported as `unassigned`. Centre-distance was tried first and failed on both ends: it dumped people
down the aisle onto the nearest canteen table and it missed people sitting at the far side of a wide cell.

### Choosing footage (measured, not guessed)

`cv/scan_footage.py` samples each candidate clip, counts detectable tables and people, and ranks the clips:

```bash
python cv/scan_footage.py cv/media/cand2/*.mp4 --json /tmp/scan.json
```

Result on ten free clips: only a food-court shot reached 6 detected tables (13 people); most library/coworking
clips gave 0–3 tables at any confidence, and a wide camera does not fix small distant tables. Ten canteen clips
and CDED-7 were both tried for the "many tables" look; the honest answer is that table recall needs the trained
model, so the demo shows what is actually detected.

### Accuracy against CDED-7 annotations

CDED-7 ships `derived_release/derived_status_boxes.csv` (one row per annotated person per frame). That is real
ground truth for per-table counts:

```bash
python cv/eval_mae.py --video class_3 --tables cv/tables/cam-library-1.json   --timeline public/cam/library.json --out public/cam/mae-library.json
# class_3: 534 table-samples, MAE 1.54 people/table (max 4) · total people MAE 3.51
```

The dashboard shows that number next to the feed (`±1.5 people/table vs CDED-7 annotations`).

### Datasets

`cv/fetch_roboflow.py` pulls Roboflow Universe exports (YOLO11 format), remaps every class onto
`person / table / chair`, drops the rest, and writes one merged `cv/dataset/data.yaml`:

```bash
export ROBOFLOW_API_KEY=...
python cv/fetch_roboflow.py libdetect/reading_room_dataset:1 studycafe/studycafe:1   teste-gxtgx/person-chair:1 object-detection-xxfkw/occupied-chair:1   oscarsurajmasterthesis/chair-bytdf:1 nikhil-ravula/chair-detection---library:1
```

Check each dataset's licence on its Universe page before publishing a model trained on it. Training stays
in `cv/train_colab.ipynb` (GPU); this laptop only runs inference.

### Auto table ids

`--auto-zones` takes table boxes from a chosen frame (`--zone-at`). When the bench itself is invisible
(canteen rows), `--cluster-zones N` clusters seated people into N zones with k-means over feet points and
labels them left to right, so "table 3 has 5 people" still comes out of the detector, not a hand-drawn box.
