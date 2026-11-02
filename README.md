# OASIS

**Open Academic Space and Interaction System** — STACK 2026, Case 1: Smarter Campus and Learning.

See it. Claim it. Share it. A zero-install PWA that shows which coworking tables are free at UPNVJT, lets a student claim one in seconds, and helps them find study partners who work the same way.

This repository is the working MVP described by `public/docs/OASIS_PRD_v3.md`.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Open the landing page and press **One-Click Demo Login**. No account, no API key needed. The demo campus is separate from the real campus rows and is labelled “Demo mode · simulated campus data”.

Optional environment (`.env.local`):

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Enables the Gemini-backed Navigator. Without it the labelled offline parser answers. |
| `GEMINI_MODEL` | Defaults to `gemini-2.0-flash`. |

`.env.example` lists them. Secrets never reach the browser: the Gemini key is read in a route handler only.

## Demo personas

| Persona | Tier / points | Seeded state |
| --- | --- | --- |
| Demo Seeker | Shallows, 20 | no session |
| Demo Host | Reef, 120 | published Networking Open Table, 2 seats open, table L3 |
| Demo Guest | Shallows, 35 | no session |
| Demo Navigator | Deep Blue, 180 | no session |

Switching personas keeps the demo state; **Reset demo** (top bar, demo only) rebuilds it. `GET /api/cron` re-seeds the demo when it goes stale, expires unchecked bookings and closes finished sessions — point a scheduler at it hourly.

## What works

- Landing page, one-click demo login, demo banner, reset.
- Radar: SVG campus map plus a room list; status derived only from bookings, check-ins, walk-ins and reports; icon + text + colour; “updated Ns ago”.
- Booking: 30–120 minutes, Deep Work / Networking, Open Table with seat stepper, topic and note; four taps from Radar to a reservation; Undo toast.
- Join: mode norms accepted in one tap, transactional seats (no overbooking), host's first name / programme / intake year only.
- QR check-in, Scan & Sit walk-in, 15-minute auto-release, “Still here?” extend prompt, I'm leaving / host close / host removes a guest.
- Points: append-only ledger, daily cap, tiers, priority tables at peak hours, three-miss perk pause, no deductions.
- Navigator: structured intent from Gemini (when a key exists) or the deterministic parser; live step trace, one clarifying question, result card with Undo and scanner, per-user rate limit, off-topic requests declined.
- Google sign-in was dropped by team decision; the build enters through demo accounts only.
- PWA manifest, service worker app shell, offline banner, reduced-motion support, dark/light via `prefers-color-scheme`.

## Verify it

```bash
npm run test:unit     # rule-level checks, no server: node scripts/unit.mjs
npm run dev           # then, in another shell:
npm run test:smoke    # 25 API journeys against localhost:3000
npm run test:ui       # 37 browser checks in headless Chrome (UI flows)
npm run test:rehearsal # PRD D9: 20 demo logins + 10 Navigator runs
```

Measured on the production build (`npm run build && npm start`), 1 Nov 2026, this machine:

| Check | Result |
| --- | --- |
| `test:unit` | 20/20 |
| `test:smoke` | 32/32 |
| `test:ui` | 35/35 across landing, user (camera line), admin (both replays, zone ids, accuracy line) and 390px mobile |
| `test:rehearsal` | 20/20 demo logins, 10/10 Navigator bookings, median ~61 ms per two-prompt run (offline parser) |
| Lighthouse (landing, mobile) | Performance 92 · Accessibility 100 · Best practices 100 |

`scripts/smoke.mjs` exercises login, booking, joining, norms, overbooking, check-in, points, release, walk-in, two-report badge, Navigator clarification and Undo, QR rendering and reset. `scripts/ui-check.mjs` drives headless Chrome over CDP; set `CHROME_PATH` if Chrome is not in the default Windows location.

## Architecture in one paragraph

Next.js App Router on the server, React client screens, one JSON document store at `.data/db.json` guarded by a write lock, and all domain rules in `lib/domain.js` executed server-side. The browser never computes points, seats or permissions: it calls `/api/act` and re-reads `/api/state` every 2 seconds. That is the whole of it. `public/docs/ARCHITECTURE.md` has the diagram, invariants and the migration path to Supabase + Realtime.

## Deviations from the PRD (honest list)

| PRD | Shipped | Why |
| --- | --- | --- |
| Supabase Postgres + RLS + Edge Functions | JSON file store + route handlers with a write lock; `supabase/schema.sql` holds the target schema | No Supabase project or card available in this build; the rules and API shape are the same, and the schema is ready to move. |
| Supabase Realtime | 2-second polling with an “updated Ns ago” label | Same user-visible behaviour at pilot scale without a second service. |
| Gemini function calling loop (4 tools) | Gemini returns a validated structured intent; the same allowlisted server actions execute it | Fewer round trips, same guarantee: no booking without a validated intent, the model never writes SQL. |
| Navigator tools named `search_tables`, `book_table`, … | Implemented as server functions of the same names in `lib/navigator.js` | Behaviour matches; only the transport differs. |
| Hourly `pg_cron` jobs | `GET /api/cron` (any scheduler) + re-seed on demo login | Free-tier friendly; a GitHub Actions workflow is included. |
| Institutional Google sign-in | Demo accounts only, by team decision | Faster path to a working demo; the PRD keeps campus auth as the production step. |
| Leaderboard, Bahasa UI toggle, voice input, rotating QR, course recommendations | Not built | Could-have items in the PRD. |
| Web Push notifications | In-app state only | iOS support needs an installed PWA; notifications were not on the critical path. |
| N8 pre-filled quick-booking form when the AI fails | The Navigator returns validated alternatives and the normal booking sheet, with a free Undo | Same recovery, fewer moving parts; nothing books without a tap. |
| P3 host points limited to the same pair twice a day | Host bonus is awarded once per guest check-in, guarded by the ledger; per-pair daily counting is not implemented | The daily cap and the one-award-per-booking guard cover the demo risk. |

Known limitation carried over from the PRD: a static table QR can be photographed. Scans are bound to an active booking, one session per user, and the two-report rule covers the gap until rotating codes ship. Demo tables publish their QR token in the app so a judge can check in without a printed code; real campus tables never do.

## Honesty notes

- Metrics in `public/docs/OASIS_PRD_v3.md` are **targets**. No baseline, pilot or Lighthouse numbers are claimed here.
- Every demo screen is labelled simulated data. Nothing seeded is presented as a real campus result.
- Google sign-in is not in this build: the team decided the demo login is enough for the submission.
- Navigator: the hosted model is called only when `GEMINI_API_KEY` is set; without a key the local parser answers deterministically and the UI says so.


### Camera preview in the admin dashboard

Two cameras, both replays, switchable in the tile: `library` (quiet study room, table boxes) and `canteen`
(busy Student Centre, table zones inferred by clustering seated people). Each has a 1:1 h264 loop at 5 fps
(257 KB and 517 KB, muted) plus a JSON timeline with the same readings keyed by video time, so the table cards
and the KPI row move with the picture instead of drifting from it.

* Footage: **CDED-7** classroom CCTV (`class_3.mp4`, Zenodo DOI 10.5281/zenodo.21207208) for the Library
  camera — research/non-commercial licence, so it is demo material only, never redistributed. The canteen
  camera uses a Pexels clip (`cv/media/cafeteria.mp4`). Video files stay out of git (`cv/media/` ignored).
* Table ids are assigned automatically by `cv/calibrate.py`: either 40 frames merged into median boxes
  (real tables), or `--grid-zones rows,cols` when the room is a grid of desks/benches (CDED-7 uses 2×3 desk
  blocks, the canteen 1×4). Zones, capacity and IDs land in `cv/tables/<camera>.json` as `T01..`. Long canteen
  benches fall back to a `--grid-zones rows,cols` split of the seated band (k-means clustering exists but
  its zones overlap, so it is not the default).
* Accuracy is measured, not asserted: `cv/eval_mae.py` scores the per-table counts against CDED-7's own
  annotations and the admin tile prints the result (`±1.5 people/table, 534 table-samples`).
* `cv/count.py` tracks people (ByteTrack), assigns each track to the nearest table **rectangle** within
  reach (not the centroid — that misfires on wide cells), smooths
  the count with a 10-sample median and writes `public/cam/<camera>.json` plus an annotated mp4.
* Training for the person-heavy model runs on Colab/Kaggle: `cv/train_colab.ipynb` (yolo11s, imgsz 960,
  100 epochs, patience 30) and exports `best.pt` back into `cv/runs/tables/weights/`.
* The overlay is baked in by `cv/detect.py` (zones from `cv/cameras.json`, model `cv/runs/tables/weights/best.pt`).
* The tile labels itself **replay**, never "live camera": there is no camera in the room during judging.
* Rebuild: `python cv/detect.py --source cv/media/cafeteria.mp4 --zone-at 12 --cluster-zones 4 --camera-id cam-canteen-1 --annotate cv/media/canteen-preview.mp4 --dump cv/media/canteen-readings.jsonl` then `node scripts/build-cam.mjs`.

## Interface

The UI is an instrument panel, not a marketing skin: ink surfaces, one phosphor-teal accent, hairline rules, mono data labels and tabular numerals, with Instrument Sans self-hosted from `public/fonts` (no webfont request, no layout shift). Status always carries icon, label and colour. The Radar is a sonar scope whose rooms are placed schematically and labelled as such; below it a three-cell status strip and a dense room list carry the real reading. Booking is one sheet: duration segment, mode cards, a real switch, seat stepper, and a CTA that restates the deal. The session screen centres a countdown dial that turns amber then red as the check-in window closes. Light theme and reduced motion are handled with tokens.

## Camera occupancy (optional, edge CV)

A second source of truth for the radar: a camera counts people per table and
posts **integers only** to `/api/sensor`. Fusion rule: a free table that the
camera sees occupied becomes `Seen occupied` (and cannot be booked); a booked
table keeps its booking status so no-shows stay visible; a reading older than
90 s is ignored and the app falls back to booking-only truth. No frames, faces
or identities leave the detector. Full detail, training recipe and metrics:
[`cv/README.md`](cv/README.md).

## Layout

```
app/            routes: landing, login, radar, navigator, scan, session, points, /api/*
components/     client screens and the shared state provider
lib/            store, seed, domain rules, auth, navigator, view models
scripts/        unit.mjs, smoke.mjs, ui-check.mjs
public/docs/    PRD v3 and ARCHITECTURE.md
supabase/       target schema and RLS policies
.data/          runtime database (git-ignored)
```
