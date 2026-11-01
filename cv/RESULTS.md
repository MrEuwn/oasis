# Detection results

Machine: Intel Core Ultra 5 115U, **no GPU** (CPU only), 16 GB RAM.
Base weights: `yolo11n.pt` (COCO). Fine-tune: 384 px, 8 epochs effective run,
batch 16, frozen backbone (freeze=15), `fraction=0.3` (≈900 train images per
epoch), AdamW lr0 0.002, 3 classes.

## Held-out val split (official COCO val2017, 132 images · 746 boxes)

| Class | Pretrained COCO mAP50 | Fine-tuned mAP50 | Δ |
| --- | --- | --- | --- |
| person | **0.857** | 0.778 | −0.079 |
| chair | 0.000 | **0.383** | +0.383 |
| dining table | 0.0002 | **0.559** | +0.559 |
| all | 0.286 | **0.573** | +0.287 |

Fine-tuned full metrics: P 0.633 · R 0.532 · mAP50 0.573 · mAP50-95 0.374.
Per class (P / R / mAP50 / mAP50-95): person .774/.711/.778/.531 ·
chair .453/.396/.383/.201 · table .672/.488/.559/.390.

Read this honestly:

- COCO weights already detect people well (0.857). The fine-tune **loses 8
  points of person mAP** because it spends capacity on furniture and sees ~900
  images per epoch instead of COCO's 118k.
- The gain is exactly where the stock model fails: chairs and dining tables in
  these scenes go from ~0 to 0.38 and 0.56 mAP50. Without them a zone cannot be
  placed automatically and a "free table" cannot be told from a chair.
- The val split is dominated by close-up dining scenes, not the campus overhead
  view, so absolute numbers understate field performance and overstate the
  person-class gap for our use case.
- A GPU run (`device=0`, 640 px, 30 epochs, full train split) is the next step
  if person mAP must stay above 0.85 while keeping furniture. The recipe is
  unchanged; only the device and epoch count differ.

## Occupancy on the demo clip (`cv/media/study.mp4`, 24 s, 4 tables)

Hand-labelled 8 timestamps × 4 tables (`cv/labels/study.json`), binary
"someone at this table" compared with the produced readings:

| Metric | Value |
| --- | --- |
| Table-level occupancy agreement | **32/32 (100%)** |
| People-count MAE per table per frame | **0.06** |

Counts are right for 6 of 8 frames and undercount 2→1 on the two frames where
one person leans behind the other. Occupancy (the thing the app shows) is
unaffected.

Speed on CPU: 1.2 s per frame at 512 px with the 3-class model (3.5 s with the
80-class COCO model on the same machine), which is why the demo samples one
frame every 3 s. No GPU was available.

Reproduce:

```bash
python cv/prepare_dataset.py --images cv/data/train2017 --ann cv/data/annotations/instances_train2017.json --split train
python cv/prepare_dataset.py --images cv/data/val2017   --ann cv/data/annotations/instances_val2017.json   --split val
yolo detect train model=yolo11n.pt data=cv/dataset/oasis-tables.yaml imgsz=384 epochs=10 batch=16 \
  device=cpu workers=2 freeze=15 lr0=0.002 fraction=0.3 project=cv/runs name=tables
yolo detect val model=cv/runs/tables/weights/best.pt data=cv/dataset/oasis-tables.yaml imgsz=512
python cv/detect.py --source cv/media/study.mp4 --model cv/runs/tables/weights/best.pt \
  --auto-zones --space Library --labels L1,L2,L3,L4 --interval 3 --dump cv/runs/study-ft.jsonl
python cv/score_occupancy.py --labels cv/labels/study.json --readings cv/runs/study-ft.jsonl
```

The baseline numbers in the first column come from `cv/make_baseline_eval.py`,
which re-labels the val split with COCO ids so an 80-class checkpoint can be
scored without the class-index mismatch.
