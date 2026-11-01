"""Score occupancy readings against hand labels.

labels JSON: {"0": {"L1": 0, "L2": 0, "L3": 0, "L4": 0}, "3": {...}, ...}
readings JSONL: one line per analysed frame, written by detect.py --dump.

Reports table-level occupancy (the thing the app shows) and people-count error.
"""

import argparse
import json
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", required=True)
    ap.add_argument("--readings", required=True)
    ap.add_argument("--tol", type=float, default=1.5, help="seconds of slack when matching a label time")
    args = ap.parse_args()

    labels = json.loads(Path(args.labels).read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in Path(args.readings).read_text(encoding="utf-8").splitlines() if line.strip()]
    if not rows:
        raise SystemExit("no readings")

    by_t = {}
    for row in rows:
        by_t[round(row["t"], 1)] = {r["label"]: r for r in row["readings"]}

    matches = 0
    total = 0
    count_abs = 0
    count_cells = 0
    misses = []
    for t_str, truth in labels.items():
        t = float(t_str)
        nearest = min(by_t, key=lambda x: abs(x - t))
        if abs(nearest - t) > args.tol:
            misses.append(f"no reading near t={t}")
            continue
        for label, people in truth.items():
            pred = by_t[nearest].get(label)
            if pred is None:
                misses.append(f"no prediction for {label} at t={t}")
                continue
            total += 1
            if bool(pred["occupied"]) == (people > 0):
                matches += 1
            else:
                misses.append(f"t={t} {label}: truth {people}p, pred {pred['people']}p")
            count_abs += abs(int(pred["people"]) - int(people))
            count_cells += 1

    acc = 100 * matches / total if total else 0
    print(f"table occupancy: {matches}/{total} ({acc:.1f}%)")
    print(f"people count MAE: {count_abs / count_cells:.2f} per table per frame" if count_cells else "no count data")
    for miss in misses[:10]:
        print("  miss:", miss)


if __name__ == "__main__":
    main()
